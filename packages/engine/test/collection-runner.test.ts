import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { runCollection } from '../src/runner/collection-runner.ts'
import { createDraftRequest } from '../src/index.ts'
import type { Collection, Folder } from '../src/types/workspace.ts'
import type { Variable } from '../src/types/variables.ts'

function startServer(handler: http.RequestListener): Promise<{ url: string; close(): Promise<void>; hits: http.IncomingMessage[] }> {
  const hits: http.IncomingMessage[] = []
  const server = http.createServer((req, res) => {
    hits.push(req)
    handler(req, res)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())), hits })
    })
  })
}

test('runs every request across N iterations and tallies pass/fail/skip', async () => {
  const server = await startServer((req, res) => {
    res.writeHead(req.url === '/fail' ? 500 : 200, { 'Content-Type': 'application/json' })
    res.end('{}')
  })
  try {
    const ok = { ...createDraftRequest({ id: 'ok', workspaceId: 'w1', url: `${server.url}/ok` }), assertions: [{ id: 'a1', type: 'statusCodeEquals' as const, target: '', expected: '200', enabled: true }] }
    const fail = { ...createDraftRequest({ id: 'fail', workspaceId: 'w1', url: `${server.url}/fail` }), assertions: [{ id: 'a2', type: 'statusCodeEquals' as const, target: '', expected: '200', enabled: true }] }
    const noAssertions = createDraftRequest({ id: 'skip', workspaceId: 'w1', url: `${server.url}/ok` })

    const summary = await runCollection({ requests: [ok, fail, noAssertions], globalVariables: [], iterations: 2 })

    assert.equal(summary.results.length, 6)
    assert.equal(summary.passed, 2) // ok × 2 iterations
    assert.equal(summary.failed, 2) // fail × 2 iterations
    assert.equal(summary.skipped, 2) // noAssertions × 2 iterations
  } finally {
    await server.close()
  }
})

test('request chaining: extracts a value from one response into the next request', async () => {
  let whoamiAuth: string | undefined
  const server = await startServer((req, res) => {
    if (req.url === '/login') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ token: 'tok_abc123' }))
      return
    }
    whoamiAuth = req.headers.authorization
    res.writeHead(200, {})
    res.end()
  })
  try {
    const login = createDraftRequest({ id: 'login', workspaceId: 'w1', url: `${server.url}/login` })
    const whoami = {
      ...createDraftRequest({ id: 'whoami', workspaceId: 'w1', url: `${server.url}/whoami` }),
      headers: [{ id: 'h1', key: 'Authorization', value: 'Bearer {{authToken}}', enabled: true }],
    }

    const summary = await runCollection({
      requests: [login, whoami],
      globalVariables: [],
      concurrency: 1,
      chainRules: [{ id: 'c1', requestId: 'login', jsonPath: '$.token', variableName: 'authToken', enabled: true }],
    })

    assert.equal(summary.results.length, 2)
    assert.equal(whoamiAuth, 'Bearer tok_abc123')
  } finally {
    await server.close()
  }
})

test('collection/folder auth inheritance reaches the real wire request', async () => {
  let receivedAuth: string | undefined
  const server = await startServer((req, res) => {
    receivedAuth = req.headers.authorization
    res.writeHead(200, {})
    res.end()
  })
  try {
    const folder: Folder = { id: 'f1', collectionId: 'c1', name: 'Folder', requestIds: ['r1'], auth: { type: 'bearer', token: 'inherited-token' } }
    const collection: Collection = { id: 'c1', name: 'Collection', workspaceId: 'w1', createdAt: 0, updatedAt: 0 }
    const req = { ...createDraftRequest({ id: 'r1', workspaceId: 'w1', url: server.url, collectionId: 'c1' }), folderId: 'f1', auth: { type: 'inherit' as const } }

    await runCollection({
      requests: [req],
      collections: [collection],
      foldersByCollection: { c1: [folder] },
      globalVariables: [],
    })

    assert.equal(receivedAuth, 'Bearer inherited-token')
  } finally {
    await server.close()
  }
})

test('cookie jar carries a session cookie from one request to the next in the same run', async () => {
  let secondRequestCookie: string | undefined
  const server = await startServer((req, res) => {
    if (req.url === '/login') {
      res.writeHead(200, { 'Set-Cookie': 'session=s3cr3t; Path=/' })
      res.end()
      return
    }
    secondRequestCookie = req.headers.cookie
    res.writeHead(200, {})
    res.end()
  })
  try {
    const login = createDraftRequest({ id: 'login', workspaceId: 'w1', url: `${server.url}/login` })
    const whoami = createDraftRequest({ id: 'whoami', workspaceId: 'w1', url: `${server.url}/whoami` })

    await runCollection({ requests: [login, whoami], globalVariables: [], concurrency: 1 })

    assert.equal(secondRequestCookie, 'session=s3cr3t')
  } finally {
    await server.close()
  }
})

test('data-file rows drive one iteration each and resolve into the request', async () => {
  const received: string[] = []
  const server = await startServer((req, res) => {
    received.push(req.headers['x-user'] as string)
    res.writeHead(200, {})
    res.end()
  })
  try {
    const req = {
      ...createDraftRequest({ id: 'r1', workspaceId: 'w1', url: server.url }),
      headers: [{ id: 'h1', key: 'X-User', value: '{{username}}', enabled: true }],
    }

    const summary = await runCollection({
      requests: [req],
      globalVariables: [],
      dataRows: [{ username: 'alice' }, { username: 'bob' }],
    })

    assert.equal(summary.iterations, 2)
    assert.deepEqual(received, ['alice', 'bob'])
  } finally {
    await server.close()
  }
})

test('bail stops the run after the first failed assertion', async () => {
  const calls: string[] = []
  const server = await startServer((req, res) => {
    calls.push(req.url ?? '')
    res.writeHead(req.url === '/fail' ? 500 : 200, {})
    res.end()
  })
  try {
    const fail = {
      ...createDraftRequest({ id: 'fail', workspaceId: 'w1', url: `${server.url}/fail` }),
      assertions: [{ id: 'a1', type: 'statusCodeEquals' as const, target: '', expected: '200', enabled: true }],
    }
    const after = createDraftRequest({ id: 'after', workspaceId: 'w1', url: `${server.url}/after` })

    const summary = await runCollection({ requests: [fail, after], globalVariables: [], concurrency: 1, bail: true, iterations: 3 })

    assert.equal(summary.failed, 1)
    assert.equal(calls.includes('/after'), false, 'bail should stop before the next request runs')
  } finally {
    await server.close()
  }
})

test('secret-flagged global variables are usable like any other variable (no codec in a plain Node run)', async () => {
  const received: string[] = []
  const server = await startServer((req, res) => {
    received.push(req.headers['x-api-key'] as string)
    res.writeHead(200, {})
    res.end()
  })
  try {
    const globalVariables: Variable[] = [
      { id: 'v1', key: 'apiKey', initialValue: 'sk_live_123', currentValue: 'sk_live_123', scope: 'global', secret: true },
    ]
    const req = {
      ...createDraftRequest({ id: 'r1', workspaceId: 'w1', url: server.url }),
      headers: [{ id: 'h1', key: 'X-Api-Key', value: '{{apiKey}}', enabled: true }],
    }
    await runCollection({ requests: [req], globalVariables })
    assert.equal(received[0], 'sk_live_123')
  } finally {
    await server.close()
  }
})
