import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { SQLiteStorage } from '@vayntforge/sqlite'
import { createDraftRequest, withSecretCodec } from '@vayntforge/engine'
import type { Collection, Folder, SecretCodec } from '@vayntforge/engine'

/** A real, reversible codec (not the desktop app's actual `safeStorage`, but exercises the exact same `withSecretCodec` code path a real app-created database went through). */
function fakeCodec(): SecretCodec {
  return {
    isAvailable: () => true,
    encrypt: (plain) => `cipher:${Buffer.from(plain, 'utf8').toString('base64')}`,
    decrypt: (payload) => {
      const match = /^cipher:(.+)$/.exec(payload)
      if (!match) throw new Error('not ciphertext')
      return Buffer.from(match[1]!, 'base64').toString('utf8')
    },
  }
}

const cliPath = join(dirname(fileURLToPath(import.meta.url)), '../dist/cli.js')

function startServer(handler: http.RequestListener): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) })
    })
  })
}

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'vayntforge-cli-')), 'test.db')
}

/**
 * `spawnSync` would block this process's event loop until the child exits —
 * fatal here, since the in-process HTTP test server the child is calling
 * back into needs THIS process's event loop running to ever respond. A real
 * bug this surfaced while writing the test, not in the CLI: every "request
 * timed out after 30s" failure during development traced back to exactly
 * this, not to the CLI or the engine's network client.
 */
function runCli(args: string[]): Promise<{ stdout: string; stderr: string; status: number | null }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString()))
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
    child.on('close', (status) => resolve({ stdout, stderr, status }))
  })
}

test('a real run: folder auth inheritance, secret override, chaining, and exit code all work end to end', async () => {
  let whoamiAuth: string | undefined
  let apiKeySeen: string | undefined
  let loginHits = 0
  const server = await startServer((req, res) => {
    if (req.url === '/login') {
      loginHits++
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ token: 'tok_e2e_999' }))
      return
    }
    whoamiAuth = req.headers.authorization
    apiKeySeen = req.headers['x-api-key'] as string | undefined
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
  })

  try {
    const dbPath = tempDb()
    const store = new SQLiteStorage({ path: dbPath })
    const workspace = store.createWorkspace({ name: 'CLI E2E Workspace' })
    const collection: Collection = store.createCollection({
      workspaceId: workspace.id,
      name: 'CLI E2E Collection',
      chainRules: [{ id: 'chain1', requestId: 'login', jsonPath: '$.token', variableName: 'authToken', enabled: true }],
    })
    const folder: Folder = store.createFolder({
      collectionId: collection.id,
      name: 'Secured',
      requestIds: [],
      auth: { type: 'bearer', token: '{{apiKey}}' },
    })

    store.saveRequest({
      ...createDraftRequest({ id: 'login', workspaceId: workspace.id, url: `${server.url}/login`, collectionId: collection.id, name: 'Login' }),
      assertions: [{ id: 'a1', type: 'statusCodeEquals', target: '', expected: '200', enabled: true }],
    })
    store.saveRequest({
      ...createDraftRequest({ id: 'whoami', workspaceId: workspace.id, url: `${server.url}/whoami`, collectionId: collection.id, name: 'Whoami' }),
      folderId: folder.id,
      auth: { type: 'inherit' },
      headers: [{ id: 'h1', key: 'X-Api-Key', value: '{{secretKey}}', enabled: true }],
      assertions: [{ id: 'a2', type: 'statusCodeEquals', target: '', expected: '200', enabled: true }],
    })
    store.saveGlobalVariable({ id: 'v1', key: 'apiKey', initialValue: 'inherited-bearer', currentValue: 'inherited-bearer', scope: 'global', secret: false, workspaceId: workspace.id })
    store.saveGlobalVariable({ id: 'v2', key: 'secretKey', initialValue: 'placeholder', currentValue: 'placeholder', scope: 'global', secret: true, workspaceId: workspace.id })

    const result = await runCli([
      'run',
      '--db',
      dbPath,
      '--workspace',
      workspace.id,
      '--collection',
      collection.id,
      '--env-var',
      'secretKey=sk_real_e2e_secret',
      '--concurrency',
      '1',
    ])

    assert.equal(loginHits, 1)
    assert.equal(whoamiAuth, 'Bearer inherited-bearer', 'folder auth inheritance should reach the real wire request')
    assert.equal(apiKeySeen, 'sk_real_e2e_secret', '--env-var should override the secret-flagged variable')
    assert.equal(result.status, 0, `expected exit 0 on an all-passing run, got ${result.status}. stderr: ${result.stderr}`)
    assert.match(result.stdout, /2 passed/)

    const savedRuns = store.listTestRuns(workspace.id)
    assert.equal(savedRuns.length, 1, 'a TestRun should be saved back into the db by default')
    assert.equal(savedRuns[0]!.passed, 2)
  } finally {
    await server.close()
  }
})

test('exits non-zero when an assertion fails, and --no-save skips writing a TestRun', async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(500, {})
    res.end()
  })
  try {
    const dbPath = tempDb()
    const store = new SQLiteStorage({ path: dbPath })
    const workspace = store.createWorkspace({ name: 'W' })
    const collection = store.createCollection({ workspaceId: workspace.id, name: 'C' })
    store.saveRequest({
      ...createDraftRequest({ id: 'r1', workspaceId: workspace.id, url: server.url, collectionId: collection.id }),
      assertions: [{ id: 'a1', type: 'statusCodeEquals', target: '', expected: '200', enabled: true }],
    })

    const result = await runCli(['run', '--db', dbPath, '--workspace', workspace.id, '--collection', collection.id, '--no-save'])
    assert.equal(result.status, 1)
    assert.equal(store.listTestRuns(workspace.id).length, 0)
  } finally {
    await server.close()
  }
})

test('a missing --db path fails clearly instead of silently creating an empty database', async () => {
  const result = await runCli(['run', '--db', '/tmp/definitely-does-not-exist-vayntforge.db', '--workspace', 'w', '--collection', 'c'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /No database file/)
})

test('an unknown workspace name fails with the available options listed', async () => {
  const dbPath = tempDb()
  const store = new SQLiteStorage({ path: dbPath })
  store.createWorkspace({ name: 'Real Workspace' })
  const result = await runCli(['run', '--db', dbPath, '--workspace', 'Nope', '--collection', 'c'])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /No workspace matches "Nope"/)
  assert.match(result.stderr, /Real Workspace/)
})

test('a secret variable with no override is sent empty, with a warning, rather than a raw db value', async () => {
  let apiKeySeen: string | undefined
  const server = await startServer((req, res) => {
    apiKeySeen = req.headers['x-api-key'] as string | undefined
    res.writeHead(200, {})
    res.end()
  })
  try {
    const dbPath = tempDb()
    const store = new SQLiteStorage({ path: dbPath })
    const workspace = store.createWorkspace({ name: 'W' })
    const collection = store.createCollection({ workspaceId: workspace.id, name: 'C' })
    store.saveRequest({
      ...createDraftRequest({ id: 'r1', workspaceId: workspace.id, url: server.url, collectionId: collection.id }),
      headers: [{ id: 'h1', key: 'X-Api-Key', value: '{{secretKey}}', enabled: true }],
    })
    store.saveGlobalVariable({ id: 'v1', key: 'secretKey', initialValue: 'x', currentValue: 'x', scope: 'global', secret: true, workspaceId: workspace.id })

    const result = await runCli(['run', '--db', dbPath, '--workspace', workspace.id, '--collection', collection.id])
    assert.equal(apiKeySeen, '', 'unresolved secret should be sent empty, never the raw (possibly ciphertext) db value')
    assert.match(result.stderr, /secret variable "secretKey" has no --env-var\/--secrets override/)
  } finally {
    await server.close()
  }
})

test('a real encrypted collection variable (from a genuinely codec-wrapped db) is never sent as raw ciphertext, and --env-var resolves it correctly', async () => {
  let apiKeySeen: string | undefined
  const server = await startServer((req, res) => {
    apiKeySeen = req.headers['x-api-key'] as string | undefined
    res.writeHead(200, {})
    res.end()
  })
  try {
    const dbPath = tempDb()
    const store = new SQLiteStorage({ path: dbPath })
    // Written through withSecretCodec, the same wrapper the real desktop
    // app's StorageService uses — the collection variable below is
    // genuinely encrypted at rest, not just conceptually "secret".
    const wrapped = withSecretCodec(store, fakeCodec())
    const workspace = store.createWorkspace({ name: 'W' })
    const collection = wrapped.createCollection({
      workspaceId: workspace.id,
      name: 'C',
      variables: [{ id: 'cv1', key: 'apiSecret', initialValue: 'real-secret', currentValue: 'real-secret', scope: 'collection', secret: true }],
    })
    store.saveRequest({
      ...createDraftRequest({ id: 'r1', workspaceId: workspace.id, url: server.url, collectionId: collection.id }),
      headers: [{ id: 'h1', key: 'X-Api-Key', value: '{{apiSecret}}', enabled: true }],
    })
    store.close()

    // Confirm it's genuinely ciphertext on disk, not just a claim.
    const rawCheck = new SQLiteStorage({ path: dbPath })
    const rawCollection = rawCheck.getCollection(collection.id)
    rawCheck.close()
    assert.notEqual(rawCollection?.variables?.[0]?.currentValue, 'real-secret', 'the CLI test setup must exercise real ciphertext, not plaintext')

    const withoutOverride = await runCli(['run', '--db', dbPath, '--workspace', workspace.id, '--collection', collection.id])
    assert.equal(apiKeySeen, '', 'without an override, the CLI must never forward the raw ciphertext value')
    assert.match(withoutOverride.stderr, /secret variable "apiSecret" has no --env-var\/--secrets override/)

    const withOverride = await runCli(['run', '--db', dbPath, '--workspace', workspace.id, '--collection', collection.id, '--env-var', 'apiSecret=the-real-secret'])
    assert.equal(apiKeySeen, 'the-real-secret')
    assert.equal(withOverride.status, 0)
  } finally {
    await server.close()
  }
})
