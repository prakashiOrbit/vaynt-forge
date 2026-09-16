import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import net from 'node:net'
import { createHash, createHmac } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { UndiciRequestClient } from '../src/networking/http-client.ts'
import { createDraftRequest, collectVariables } from '../src/index.ts'

function startServer(handler: http.RequestListener): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((r) => server.close(() => r())),
      })
    })
  })
}

const emptyCtx = { variables: collectVariables({}) }

test('performs a real GET and parses status/headers/JSON body/size', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json', 'X-Test': 'yes' })
    res.end(JSON.stringify({ ok: true }))
  })
  try {
    const req = createDraftRequest({ id: 'r1', workspaceId: 'w1', url: `${server.url}/ok` })
    const res = await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(res.status, 200)
    assert.equal(res.statusText, 'OK')
    assert.deepEqual(res.body, { ok: true })
    assert.equal(res.headers['x-test'], 'yes')
    assert.equal(res.size, Buffer.byteLength(JSON.stringify({ ok: true })))
    assert.ok(res.timeMs >= 0)
    assert.equal(res.timing.dns + res.timing.connect + res.timing.tls + res.timing.wait + res.timing.download >= 0, true)
  } finally {
    await server.close()
  }
})

test('follows redirects and records the chain', async () => {
  const server = await startServer((req, res) => {
    if (req.url === '/start') {
      res.writeHead(302, { Location: '/final' })
      res.end()
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ landed: true }))
  })
  try {
    const req = createDraftRequest({ id: 'r2', workspaceId: 'w1', url: `${server.url}/start` })
    req.settings.followRedirects = true
    req.settings.maxRedirects = 5
    const res = await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { landed: true })
    assert.equal(res.redirects.length, 1)
    assert.equal(res.redirects[0]?.status, 302)
  } finally {
    await server.close()
  }
})

test('does not follow redirects when followRedirects is false', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(302, { Location: '/final' })
    res.end()
  })
  try {
    const req = createDraftRequest({ id: 'r3', workspaceId: 'w1', url: `${server.url}/start` })
    req.settings.followRedirects = false
    const res = await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(res.status, 302)
    assert.equal(res.redirects.length, 0)
  } finally {
    await server.close()
  }
})

test('applies bearer auth as a real Authorization header', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'r4', workspaceId: 'w1', url: `${server.url}/ok` })
    req.auth = { type: 'bearer', token: 'secret-token' }
    await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(seenAuth, 'Bearer secret-token')
  } finally {
    await server.close()
  }
})

// Found by actually sending a real request with `{{authToken}}` typed into
// the Bearer Token field — the obvious way to keep a secret out of the
// request itself — and discovering the literal, unresolved placeholder went
// out over the wire instead of the real token. Every other value in the app
// resolved `{{variables}}`; auth fields were the one silent exception.
test('resolves a {{variable}} inside a bearer token before sending', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'r11', workspaceId: 'w1', url: `${server.url}/ok` })
    req.auth = { type: 'bearer', token: '{{authToken}}' }
    const ctx = { variables: collectVariables({ environment: [{ key: 'authToken', value: 'real-secret-999' }] }) }
    await new UndiciRequestClient().execute(req, ctx)
    assert.equal(seenAuth, 'Bearer real-secret-999')
  } finally {
    await server.close()
  }
})

test('resolves {{variables}} inside basic-auth username/password', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'r12', workspaceId: 'w1', url: `${server.url}/ok` })
    req.auth = { type: 'basic', username: '{{user}}', password: '{{pass}}' }
    const ctx = {
      variables: collectVariables({
        environment: [
          { key: 'user', value: 'admin' },
          { key: 'pass', value: 'hunter2' },
        ],
      }),
    }
    await new UndiciRequestClient().execute(req, ctx)
    assert.equal(seenAuth, `Basic ${Buffer.from('admin:hunter2').toString('base64')}`)
  } finally {
    await server.close()
  }
})

test('resolves a {{variable}} inside an apiKey header value', async () => {
  let seenKey = ''
  const server = await startServer((req, res) => {
    seenKey = (req.headers['x-api-key'] as string) ?? ''
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'r13', workspaceId: 'w1', url: `${server.url}/ok` })
    req.auth = { type: 'apiKey', location: 'header', key: 'X-API-Key', value: '{{apiKey}}' }
    const ctx = { variables: collectVariables({ environment: [{ key: 'apiKey', value: 'key-abc-123' }] }) }
    await new UndiciRequestClient().execute(req, ctx)
    assert.equal(seenKey, 'key-abc-123')
  } finally {
    await server.close()
  }
})

test('resolves {{variables}} in the URL before sending', async () => {
  let seenPath = ''
  const server = await startServer((req, res) => {
    seenPath = req.url ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'r5', workspaceId: 'w1', url: `${server.url}/users/{{userId}}` })
    const ctx = { variables: collectVariables({ global: [{ key: 'userId', value: 'usr_42' }] }) }
    await new UndiciRequestClient().execute(req, ctx)
    assert.equal(seenPath, '/users/usr_42')
  } finally {
    await server.close()
  }
})

test('reports a 500 as a normal (non-error) response', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'boom' }))
  })
  try {
    const req = createDraftRequest({ id: 'r6', workspaceId: 'w1', url: `${server.url}/error` })
    const res = await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(res.status, 500)
    assert.equal(res.error, undefined)
    assert.deepEqual(res.body, { error: 'boom' })
  } finally {
    await server.close()
  }
})

test('connection failure surfaces as a ClientError, not a throw', async () => {
  const req = createDraftRequest({ id: 'r7', workspaceId: 'w1', url: 'http://127.0.0.1:1/unreachable' })
  const res = await new UndiciRequestClient().execute(req, emptyCtx)
  assert.equal(res.status, 0)
  assert.ok(res.error)
  assert.ok(res.error!.message.length > 0)
})

test('an invalid URL surfaces as a ClientError, not a throw', async () => {
  const req = createDraftRequest({ id: 'r8', workspaceId: 'w1', url: 'not a url' })
  const res = await new UndiciRequestClient().execute(req, emptyCtx)
  assert.equal(res.status, 0)
  assert.ok(res.error)
})

// Found by actually sending a real request to a real API (GitHub's) and
// getting rejected — real-world APIs commonly require a User-Agent header,
// which this client sent with none at all before this fix.
test('sends a default User-Agent when the request has none', async () => {
  let receivedUA: string | undefined
  const server = await startServer((req, res) => {
    receivedUA = req.headers['user-agent']
    res.writeHead(200)
    res.end('ok')
  })
  try {
    const req = createDraftRequest({ id: 'r9', workspaceId: 'w1', url: `${server.url}/ua` })
    await new UndiciRequestClient().execute(req, emptyCtx)
    assert.ok(receivedUA, 'expected a User-Agent header to be sent')
    assert.match(receivedUA!, /VayntForge/)
  } finally {
    await server.close()
  }
})

test('an explicit User-Agent header overrides the default', async () => {
  let receivedUA: string | undefined
  const server = await startServer((req, res) => {
    receivedUA = req.headers['user-agent']
    res.writeHead(200)
    res.end('ok')
  })
  try {
    const req = createDraftRequest({ id: 'r10', workspaceId: 'w1', url: `${server.url}/ua` })
    req.headers.push({ id: 'h1', key: 'User-Agent', value: 'MyCustomAgent/2.0', enabled: true })
    await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(receivedUA, 'MyCustomAgent/2.0')
  } finally {
    await server.close()
  }
})

test('Digest auth: gets a real 401 challenge, then resends with a matching response hash', async () => {
  const realm = 'test-realm'
  const nonce = 'server-nonce-123'
  let requestCount = 0
  let secondAuthHeader = ''
  const server = await startServer((req, res) => {
    requestCount += 1
    const authHeader = req.headers.authorization
    if (!authHeader) {
      res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${realm}", nonce="${nonce}", qop="auth"` })
      res.end()
      return
    }
    secondAuthHeader = authHeader
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'rd1', workspaceId: 'w1', url: `${server.url}/secure` })
    req.auth = { type: 'digest', username: 'admin', password: 'hunter2' }
    const res = await new UndiciRequestClient().execute(req, emptyCtx)

    assert.equal(requestCount, 2)
    assert.equal(res.status, 200)
    assert.match(secondAuthHeader, /^Digest /)

    const params: Record<string, string> = {}
    for (const m of secondAuthHeader.matchAll(/(\w+)=(?:"([^"]*)"|([^,\s]*))/g)) {
      const key = m[1]
      if (key) params[key] = m[2] !== undefined ? m[2] : (m[3] ?? '')
    }
    assert.equal(params.username, 'admin')
    assert.equal(params.realm, realm)
    assert.equal(params.nonce, nonce)
    assert.equal(params.uri, '/secure')
    assert.equal(params.qop, 'auth')

    const ha1 = createHash('md5').update('admin:test-realm:hunter2').digest('hex')
    const ha2 = createHash('md5').update('GET:/secure').digest('hex')
    const expectedResponse = createHash('md5')
      .update(`${ha1}:${nonce}:${params.nc}:${params.cnonce}:auth:${ha2}`)
      .digest('hex')
    assert.equal(params.response, expectedResponse)
  } finally {
    await server.close()
  }
})

test('Digest auth: resolves {{variables}} inside username/password', async () => {
  const realm = 'r'
  const nonce = 'n1'
  let secondAuthHeader = ''
  const server = await startServer((req, res) => {
    if (!req.headers.authorization) {
      res.writeHead(401, { 'WWW-Authenticate': `Digest realm="${realm}", nonce="${nonce}", qop="auth"` })
      res.end()
      return
    }
    secondAuthHeader = req.headers.authorization
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'rd2', workspaceId: 'w1', url: `${server.url}/secure` })
    req.auth = { type: 'digest', username: '{{u}}', password: '{{p}}' }
    const ctx = {
      variables: collectVariables({
        environment: [
          { key: 'u', value: 'realuser' },
          { key: 'p', value: 'realpass' },
        ],
      }),
    }
    await new UndiciRequestClient().execute(req, ctx)
    assert.match(secondAuthHeader, /username="realuser"/)
  } finally {
    await server.close()
  }
})

test('OAuth 1.0a: signs the request with a real HMAC-SHA1 signature matching a manual recomputation', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'ro1', workspaceId: 'w1', url: `${server.url}/resource?foo=bar` })
    req.auth = {
      type: 'oauth1',
      consumerKey: 'ck123',
      consumerSecret: 'cs456',
      token: 'tok789',
      tokenSecret: 'ts012',
      signatureMethod: 'HMAC-SHA1',
    }
    await new UndiciRequestClient().execute(req, emptyCtx)

    assert.match(seenAuth, /^OAuth /)
    const params: Record<string, string> = {}
    for (const m of seenAuth.matchAll(/(oauth_\w+)="([^"]*)"/g)) {
      const key = m[1]
      if (key) params[key] = decodeURIComponent(m[2] ?? '')
    }
    assert.equal(params.oauth_consumer_key, 'ck123')
    assert.equal(params.oauth_token, 'tok789')
    assert.equal(params.oauth_signature_method, 'HMAC-SHA1')
    assert.equal(params.oauth_version, '1.0')

    const baseParams = [
      ['foo', 'bar'],
      ['oauth_consumer_key', 'ck123'],
      ['oauth_nonce', params.oauth_nonce ?? ''],
      ['oauth_signature_method', 'HMAC-SHA1'],
      ['oauth_timestamp', params.oauth_timestamp ?? ''],
      ['oauth_token', 'tok789'],
      ['oauth_version', '1.0'],
    ].sort(([a], [b]) => ((a ?? '') < (b ?? '') ? -1 : 1))
    const normalized = baseParams.map(([k, v]) => `${k}=${v}`).join('&')
    const baseString = `GET&${encodeURIComponent(`${server.url}/resource`)}&${encodeURIComponent(normalized)}`
    const expectedSignature = createHmac('sha1', 'cs456&ts012').update(baseString).digest('base64')
    assert.equal(params.oauth_signature, expectedSignature)
  } finally {
    await server.close()
  }
})

test('OAuth 1.0a: PLAINTEXT signature is the raw consumer-secret&token-secret pair', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'ro2', workspaceId: 'w1', url: `${server.url}/resource` })
    req.auth = {
      type: 'oauth1',
      consumerKey: 'ck',
      consumerSecret: 'cs',
      token: '',
      tokenSecret: '',
      signatureMethod: 'PLAINTEXT',
    }
    await new UndiciRequestClient().execute(req, emptyCtx)
    assert.match(seenAuth, /oauth_signature="cs%26"/)
  } finally {
    await server.close()
  }
})

test('AWS SigV4: signs the request with a real signature matching a manual recomputation', async () => {
  let seenHeaders: http.IncomingHttpHeaders = {}
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenHeaders = req.headers
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'raws1', workspaceId: 'w1', url: `${server.url}/items?b=2&a=1`, method: 'POST' })
    req.body = { type: 'raw', language: 'json', content: '{"x":1}' }
    req.auth = { type: 'aws', accessKey: 'AKIDEXAMPLE', secretKey: 'secretkey123', region: 'us-east-1', service: 'execute-api' }
    await new UndiciRequestClient().execute(req, emptyCtx)

    assert.match(seenAuth, /^AWS4-HMAC-SHA256 /)
    const amzDate = (seenHeaders['x-amz-date'] as string) ?? ''
    const contentSha256 = (seenHeaders['x-amz-content-sha256'] as string) ?? ''
    assert.equal(contentSha256, createHash('sha256').update('{"x":1}').digest('hex'))

    const params: Record<string, string> = {}
    for (const m of seenAuth.matchAll(/(\w+)=([^\s,]+)/g)) {
      if (m[1] === 'AWS4-HMAC-SHA256') continue
      const key = m[1]
      if (key) params[key] = (m[2] ?? '').replace(/,$/, '')
    }
    assert.match(params.Credential ?? '', /^AKIDEXAMPLE\//)
    // Real SigV4 signs whatever headers are actually present (here, the
    // client's own default Content-Type/User-Agent alongside the required
    // host/x-amz-* ones) — assert against the real SignedHeaders list rather
    // than a hand-picked subset, then use exactly that list (and the real
    // header values) to independently recompute the signature.
    const signedHeaderNames = (params.SignedHeaders ?? '').split(';')
    assert.ok(signedHeaderNames.includes('host'))
    assert.ok(signedHeaderNames.includes('x-amz-date'))
    assert.ok(signedHeaderNames.includes('x-amz-content-sha256'))
    assert.deepEqual(signedHeaderNames, [...signedHeaderNames].sort())

    const canonicalHeaders = signedHeaderNames.map((name) => `${name}:${String(seenHeaders[name]).trim()}\n`).join('')
    const dateStamp = amzDate.slice(0, 8)
    const canonicalRequest = ['POST', '/items', 'a=1&b=2', canonicalHeaders, signedHeaderNames.join(';'), contentSha256].join('\n')
    const credentialScope = `${dateStamp}/us-east-1/execute-api/aws4_request`
    const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, createHash('sha256').update(canonicalRequest).digest('hex')].join('\n')
    const hmac = (key: Buffer | string, data: string) => createHmac('sha256', key).update(data).digest()
    const kDate = hmac('AWS4secretkey123', dateStamp)
    const kRegion = hmac(kDate, 'us-east-1')
    const kService = hmac(kRegion, 'execute-api')
    const kSigning = hmac(kService, 'aws4_request')
    const expectedSignature = hmac(kSigning, stringToSign).toString('hex')

    assert.equal(params.Signature, expectedSignature)
  } finally {
    await server.close()
  }
})

test('AWS SigV4: includes X-Amz-Security-Token for temporary STS credentials', async () => {
  let seenToken = ''
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenToken = (req.headers['x-amz-security-token'] as string) ?? ''
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'raws2', workspaceId: 'w1', url: `${server.url}/x` })
    req.auth = {
      type: 'aws',
      accessKey: 'AKID',
      secretKey: 'secret',
      region: 'us-west-2',
      service: 's3',
      sessionToken: 'FQoGZXIvYXdzEB',
    }
    await new UndiciRequestClient().execute(req, emptyCtx)
    assert.equal(seenToken, 'FQoGZXIvYXdzEB')
    assert.match(seenAuth, /SignedHeaders=[\w;-]*x-amz-security-token/)
  } finally {
    await server.close()
  }
})

test('AWS SigV4: resolves {{variables}} inside credentials', async () => {
  let seenAuth = ''
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization ?? ''
    res.writeHead(200)
    res.end('{}')
  })
  try {
    const req = createDraftRequest({ id: 'raws3', workspaceId: 'w1', url: `${server.url}/x` })
    req.auth = { type: 'aws', accessKey: '{{ak}}', secretKey: '{{sk}}', region: 'us-east-1', service: 'execute-api' }
    const ctx = { variables: collectVariables({ environment: [{ key: 'ak', value: 'RealAccessKey' }, { key: 'sk', value: 'RealSecretKey' }] }) }
    await new UndiciRequestClient().execute(req, ctx)
    assert.match(seenAuth, /Credential=RealAccessKey\//)
  } finally {
    await server.close()
  }
})

/* -------------------------------- Proxy support -------------------------------- */

// Real forward proxies (corporate proxies, Charles, mitmproxy, Squid) tunnel
// via HTTP CONNECT for both http:// and https:// targets, and so does
// undici's ProxyAgent by default (`proxyTunnel: true`) — this test proxy
// mirrors that instead of the simpler (but non-representative) "rewrite the
// request line" forward-proxy style.
function startProxyServer(): Promise<{ port: number; hits: string[]; close(): Promise<void> }> {
  const hits: string[] = []
  const server = http.createServer((_req, res) => {
    res.writeHead(400)
    res.end('CONNECT only')
  })
  server.on('connect', (req, clientSocket, head) => {
    hits.push(req.url ?? '')
    const [hostname, portStr] = (req.url ?? '').split(':')
    const serverSocket = net.connect(Number(portStr) || 80, hostname, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      serverSocket.write(head)
      serverSocket.pipe(clientSocket)
      clientSocket.pipe(serverSocket)
    })
    serverSocket.on('error', () => clientSocket.destroy())
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ port, hits, close: () => new Promise((r) => server.close(() => r())) })
    })
  })
}

test('proxy: a real request genuinely tunnels through the configured proxy, not directly to the target', async () => {
  const target = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ viaProxy: true }))
  })
  const proxy = await startProxyServer()
  try {
    const req = createDraftRequest({ id: 'rproxy1', workspaceId: 'w1', url: `${target.url}/probe` })
    const ctx = { variables: collectVariables({}), proxy: { enabled: true, host: '127.0.0.1', port: proxy.port } }
    const res = await new UndiciRequestClient().execute(req, ctx)
    assert.equal(res.status, 200)
    assert.deepEqual(res.body, { viaProxy: true })
    assert.equal(proxy.hits.length, 1)
    assert.equal(proxy.hits[0], new URL(target.url).host)
  } finally {
    await proxy.close()
    await target.close()
  }
})

test('proxy: disabled proxy config does not route through it', async () => {
  const target = await startServer((req, res) => {
    res.writeHead(200)
    res.end('{}')
  })
  const proxy = await startProxyServer()
  try {
    const req = createDraftRequest({ id: 'rproxy2', workspaceId: 'w1', url: `${target.url}/probe` })
    const ctx = { variables: collectVariables({}), proxy: { enabled: false, host: '127.0.0.1', port: proxy.port } }
    const res = await new UndiciRequestClient().execute(req, ctx)
    assert.equal(res.status, 200)
    assert.equal(proxy.hits.length, 0)
  } finally {
    await proxy.close()
    await target.close()
  }
})

/* ----------------------------- Custom CA certificates -------------------------- */

test('caCertificates: a self-signed server fails without the cert, succeeds once it is trusted', async () => {
  const { execFileSync } = await import('node:child_process')
  const { mkdtempSync, readFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const https = await import('node:https')

  const dir = mkdtempSync(join(tmpdir(), 'vf-ca-test-'))
  const keyPath = join(dir, 'key.pem')
  const certPath = join(dir, 'cert.pem')
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath,
    '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
  ])
  const key = readFileSync(keyPath, 'utf8')
  const cert = readFileSync(certPath, 'utf8')

  const server = https.createServer({ key, cert }, (_req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ secure: true }))
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const url = `https://127.0.0.1:${port}/secure`

  try {
    const req = createDraftRequest({ id: 'rca1', workspaceId: 'w1', url })
    const withoutCa = await new UndiciRequestClient().execute(req, { variables: collectVariables({}) })
    assert.equal(withoutCa.status, 0)
    assert.ok(withoutCa.error, 'expected an untrusted-cert error with no custom CA configured')

    const withCa = await new UndiciRequestClient().execute(req, { variables: collectVariables({}), caCertificates: [cert] })
    assert.equal(withCa.status, 200)
    assert.deepEqual(withCa.body, { secure: true })
  } finally {
    await new Promise((r) => server.close(() => r(undefined)))
  }
})

/* ---------------------------- Client (mTLS) certificates ------------------------ */

test('clientCertificates: a server requiring mTLS rejects without a matching cert, succeeds once one is configured', async () => {
  const { execFileSync } = await import('node:child_process')
  const { mkdtempSync, readFileSync } = await import('node:fs')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const https = await import('node:https')

  const dir = mkdtempSync(join(tmpdir(), 'vf-mtls-test-'))
  const serverKeyPath = join(dir, 'server-key.pem')
  const serverCertPath = join(dir, 'server-cert.pem')
  const clientKeyPath = join(dir, 'client-key.pem')
  const clientCertPath = join(dir, 'client-cert.pem')

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', serverKeyPath, '-out', serverCertPath,
    '-days', '1', '-nodes', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1',
  ])
  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-keyout', clientKeyPath, '-out', clientCertPath,
    '-days', '1', '-nodes', '-subj', '/CN=test-client',
  ])

  const serverKey = readFileSync(serverKeyPath, 'utf8')
  const serverCert = readFileSync(serverCertPath, 'utf8')
  const clientCert = readFileSync(clientCertPath, 'utf8')

  // Trusting the self-signed client cert as its own CA is the standard way
  // to test mTLS without standing up a real certificate authority.
  const server = https.createServer(
    { key: serverKey, cert: serverCert, requestCert: true, rejectUnauthorized: true, ca: [clientCert] },
    (_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ mtls: true }))
    }
  )
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  const url = `https://127.0.0.1:${port}/secure`

  try {
    // Server-cert trust is a separate concern (covered by the caCertificates
    // test above) — turned off here to isolate the client-cert requirement.
    const req = createDraftRequest({ id: 'rmtls1', workspaceId: 'w1', url })
    req.settings.sslVerify = false

    const without = await new UndiciRequestClient().execute(req, { variables: collectVariables({}) })
    assert.equal(without.status, 0)
    assert.ok(without.error, 'expected a handshake failure with no client cert configured')

    const withCert = await new UndiciRequestClient().execute(req, {
      variables: collectVariables({}),
      clientCertificates: [
        { id: 'c1', host: '127.0.0.1', port, certPath: clientCertPath, keyPath: clientKeyPath, addedAt: Date.now() },
      ],
    })
    assert.equal(withCert.status, 200)
    assert.deepEqual(withCert.body, { mtls: true })
  } finally {
    await new Promise((r) => server.close(() => r(undefined)))
  }
})

test('clientCertificates: a port-scoped entry does not match a different port', async () => {
  const req = createDraftRequest({ id: 'rmtls2', workspaceId: 'w1', url: 'https://127.0.0.1:9999/x' })
  req.settings.sslVerify = false
  const res = await new UndiciRequestClient().execute(req, {
    variables: collectVariables({}),
    clientCertificates: [
      { id: 'c2', host: '127.0.0.1', port: 1234, certPath: '/nonexistent/cert.pem', keyPath: '/nonexistent/key.pem', addedAt: Date.now() },
    ],
  })
  // Wrong port means no match, so no attempt to read the (nonexistent) cert
  // files — the request should fail with a real connection error, not an
  // ENOENT from a file it should never have tried to open.
  assert.equal(res.status, 0)
  assert.doesNotMatch(res.error?.message ?? '', /ENOENT|no such file/i)
})
