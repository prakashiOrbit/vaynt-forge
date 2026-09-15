import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
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
