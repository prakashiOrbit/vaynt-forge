import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { fetchClientCredentialsToken } from '../src/networking/oauth2-client.ts'
import type { OAuth2Config } from '../src/types/request.ts'

function startServer(handler: http.RequestListener): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) })
    })
  })
}

function baseConfig(tokenUrl: string): OAuth2Config {
  return {
    type: 'oauth2',
    grantType: 'client_credentials',
    tokenUrl,
    clientId: 'my-client',
    clientSecret: 'my-secret',
    scopes: 'read write',
    accessToken: '',
  }
}

test('fetches a real token via HTTP Basic auth and parses expires_in into an absolute expiresAt', async () => {
  let receivedAuth = ''
  let receivedBody = ''
  const server = await startServer((req, res) => {
    receivedAuth = req.headers.authorization ?? ''
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      receivedBody = raw
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'real-token-abc', token_type: 'Bearer', expires_in: 3600 }))
    })
  })
  try {
    const before = Date.now()
    const result = await fetchClientCredentialsToken(baseConfig(`${server.url}/oauth/token`))
    assert.equal(result.error, undefined)
    assert.equal(result.accessToken, 'real-token-abc')
    assert.equal(result.tokenType, 'Bearer')
    assert.ok(result.expiresAt! >= before + 3600 * 1000)
    assert.equal(receivedAuth, `Basic ${Buffer.from('my-client:my-secret').toString('base64')}`)
    const params = new URLSearchParams(receivedBody)
    assert.equal(params.get('grant_type'), 'client_credentials')
    assert.equal(params.get('scope'), 'read write')
    assert.equal(params.get('client_id'), 'my-client')
    assert.equal(params.get('client_secret'), 'my-secret')
  } finally {
    await server.close()
  }
})

test('a server that only checks body credentials (not Basic auth) still succeeds', async () => {
  const server = await startServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const params = new URLSearchParams(raw)
      if (params.get('client_id') !== 'my-client' || params.get('client_secret') !== 'my-secret') {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'invalid_client' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ access_token: 'tok', expires_in: 60 }))
    })
  })
  try {
    const result = await fetchClientCredentialsToken(baseConfig(`${server.url}/token`))
    assert.equal(result.accessToken, 'tok')
  } finally {
    await server.close()
  }
})

test('a real RFC 6749 error response surfaces error_description', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'invalid_client', error_description: 'Client authentication failed' }))
  })
  try {
    const result = await fetchClientCredentialsToken(baseConfig(`${server.url}/token`))
    assert.equal(result.accessToken, undefined)
    assert.equal(result.error, 'Client authentication failed')
  } finally {
    await server.close()
  }
})

test('a non-JSON error response is still surfaced, not thrown', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(502, { 'Content-Type': 'text/html' })
    res.end('<html>Bad Gateway</html>')
  })
  try {
    const result = await fetchClientCredentialsToken(baseConfig(`${server.url}/token`))
    assert.ok(result.error?.includes('502'))
  } finally {
    await server.close()
  }
})

test('a response with no access_token field is a clear error, not a crash', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })
  try {
    const result = await fetchClientCredentialsToken(baseConfig(`${server.url}/token`))
    assert.match(result.error!, /no access_token/)
  } finally {
    await server.close()
  }
})

test('missing Token URL / Client ID / Client Secret are validated before any request goes out', async () => {
  const missingUrl = await fetchClientCredentialsToken({ ...baseConfig(''), clientId: 'x', clientSecret: 'y' })
  assert.match(missingUrl.error!, /Token URL/)

  const missingCreds = await fetchClientCredentialsToken({ ...baseConfig('http://localhost:1'), clientId: '', clientSecret: '' })
  assert.match(missingCreds.error!, /Client ID/)
})

test('connection failure surfaces as a real error, not a throw', async () => {
  const result = await fetchClientCredentialsToken(baseConfig('http://127.0.0.1:1/unreachable'))
  assert.ok(result.error)
  assert.equal(result.accessToken, undefined)
})
