import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SQLiteStorage } from '../src/index'
import type { Environment, RequestModel, SecretCodec } from '@vayntforge/engine'
import { withSecretCodec, seedProvider, DEFAULT_APP_SETTINGS } from '@vayntforge/engine'

/** Open a store, wrap it with the codec, and seed the demo (as the app does). */
function seededStore(path: string): {
  store: SQLiteStorage
  wrapped: ReturnType<typeof withSecretCodec>
  codec: SecretCodec
} {
  const store = new SQLiteStorage({ path })
  const codec = sealedCodec()
  const wrapped = withSecretCodec(store, codec)
  if (store.listWorkspaces().length === 0) seedProvider(wrapped)
  return { store, wrapped, codec }
}

function tempDb(): string {
  return join(mkdtempSync(join(tmpdir(), 'vayntforge-')), 'test.db')
}

function sampleRequest(id: string, workspaceId: string, collectionId?: string): RequestModel {
  return {
    id,
    name: `Request ${id}`,
    method: 'GET',
    url: `https://api.example.com/${id}`,
    workspaceId,
    collectionId,
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    assertions: [],
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true },
    variables: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function sampleEnvironment(id: string, workspaceId: string): Environment {
  return {
    id,
    name: `Env ${id}`,
    phase: 'Development',
    isProduction: false,
    workspaceId,
    variables: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function sealedCodec(): SecretCodec {
  return {
    isAvailable: () => true,
    encrypt: (plain) => `cipher:${Buffer.from(plain, 'utf8').toString('base64')}`,
    decrypt: (payload) => {
      const match = /^cipher:(.+)$/.exec(payload)
      if (!match) throw new Error('bad payload')
      return Buffer.from(match[1]!, 'base64').toString('utf8')
    },
  }
}

test('seeds the Acme API demo on an empty db (first launch)', () => {
  const path = tempDb()
  const { store, codec } = seededStore(path)
  const [ws] = store.listWorkspaces()
  assert.equal(ws!.name, 'Acme API')
  assert.equal(store.listCollections(ws!.id).length, 4)
  assert.equal(store.listRequests(ws!.id).length, 13)
  assert.equal(store.listEnvironments(ws!.id).length, 4)
  assert.equal(store.listMockServers(ws!.id).length, 1)
  assert.equal(store.listHistory(ws!.id).length, 5)
  assert.deepEqual(store.getSettings(ws!.id), DEFAULT_APP_SETTINGS)
  assert.equal(
    store.listEnvironments(ws!.id).some((e) => e.variables.some((v) => v.secret)),
    true,
    'demo includes secret variables'
  )
  store.close()

  const raw = new DatabaseSync(path)
  const rows = raw.prepare('SELECT data FROM environments').all() as Array<{ data: string }>
  raw.close()
  for (const r of rows) {
    assert.equal(
      r.data.includes('prod-token-secret') || r.data.includes('dev-token-abc') || r.data.includes('test-token-xyz'),
      false,
      'seeded secrets must not appear in raw db dump'
    )
    const parsed = JSON.parse(r.data) as Environment
    for (const v of parsed.variables.filter((x) => x.secret)) {
      assert.equal(v.currentValue.startsWith('cipher:'), true, 'seeded secret stored encrypted')
    }
  }
  assert.equal(codec.decrypt('cipher:' + Buffer.from('prod-token-secret', 'utf8').toString('base64')), 'prod-token-secret')
})

test('does not re-seed on subsequent launches', () => {
  const path = tempDb()
  const first = seededStore(path)
  first.store.createWorkspace({ name: 'Second WS' })
  const wsCount = first.store.listWorkspaces().length
  first.store.close()

  const second = seededStore(path)
  assert.equal(second.store.listWorkspaces().length, wsCount)
  assert.deepEqual(second.store.listWorkspaces().map((w) => w.name).sort(), ['Acme API', 'Second WS'])
  second.store.close()
})

test('CRUD persists across restart (close + reopen)', () => {
  const path = tempDb()
  const first = new SQLiteStorage({ path })
  const ws = first.createWorkspace({ name: 'Persist me' })
  const col = first.createCollection({ name: 'Users', workspaceId: ws.id })
  first.saveRequest(sampleRequest('req_persist', ws.id, col.id))
  const env: Environment = {
    ...sampleEnvironment('env_persist', ws.id),
    variables: [
      { id: 'v1', key: 'token', initialValue: 'abc', currentValue: 'abc', scope: 'environment', secret: true },
    ],
  }
  first.saveEnvironment(env)
  first.saveGlobalVariable({
    id: 'g1', key: 'region', initialValue: 'eu', currentValue: 'eu', scope: 'global', secret: false, workspaceId: ws.id,
  })
  first.saveMockServer({
    id: 'mock_p', name: 'P', workspaceId: ws.id, port: 4020, status: 'stopped',
    latencyMs: 0, endpoints: [], log: [], createdAt: Date.now(), updatedAt: Date.now(),
  })
  first.saveSettings(ws.id, { ...DEFAULT_APP_SETTINGS, theme: 'light' })
  first.addHistory({
    workspaceId: ws.id, requestId: 'req_persist', requestName: 'P', method: 'GET',
    url: 'https://x', status: 200, statusText: 'OK', durationMs: 5, timestamp: Date.now(),
  })
  first.saveTestRun({
    id: 'run_p', name: 'R', workspaceId: ws.id, startedAt: Date.now(),
    iterations: 1, passed: 1, failed: 0, skipped: 0, results: [],
  })
  first.updateWorkspace(ws.id, { name: 'Persist me v2' })
  first.close()

  const second = new SQLiteStorage({ path })
  assert.equal(second.listWorkspaces().length, 1)
  assert.equal(second.getWorkspace(ws.id)?.name, 'Persist me v2')
  assert.equal(second.listCollections(ws.id)[0]?.name, 'Users')
  assert.equal(second.getRequest('req_persist')?.url, 'https://api.example.com/req_persist')
  assert.equal(second.getEnvironment('env_persist')?.variables[0]?.currentValue, 'abc')
  assert.equal(second.listGlobalVariables(ws.id)[0]?.key, 'region')
  assert.equal(second.listMockServers(ws.id)[0]?.id, 'mock_p')
  assert.equal(second.getSettings(ws.id)?.theme, 'light')
  assert.equal(second.listHistory(ws.id).length, 1)
  assert.equal(second.listTestRuns(ws.id).length, 1)
  second.close()
})

test('workspaces are fully isolated', () => {
  const store = new SQLiteStorage({ path: tempDb() })
  const wsA = store.createWorkspace({ name: 'A' })
  const wsB = store.createWorkspace({ name: 'B' })
  store.saveEnvironment(sampleEnvironment('env_a', wsA.id))
  store.saveEnvironment(sampleEnvironment('env_b', wsB.id))
  store.saveRequest(sampleRequest('req_a', wsA.id))

  assert.deepEqual(store.listRequests(wsB.id), [], 'no request leak')
  assert.deepEqual(store.listEnvironments(wsB.id).map((e) => e.id), ['env_b'])
  assert.equal(store.listHistory(wsB.id).length, 0)
  store.close()
})

test('deleteWorkspace cascades to every scoped entity', () => {
  const store = new SQLiteStorage({ path: tempDb() })
  const ws = store.createWorkspace({ name: 'Gone' })
  const col = store.createCollection({ name: 'X', workspaceId: ws.id })
  store.createFolder({ collectionId: col.id, name: 'F', requestIds: [] })
  store.saveEnvironment(sampleEnvironment('env_g', ws.id))
  store.saveMockServer({
    id: 'mock_g', name: 'G', workspaceId: ws.id, port: 4030, status: 'stopped',
    latencyMs: 0, endpoints: [], log: [], createdAt: Date.now(), updatedAt: Date.now(),
  })
  store.saveSettings(ws.id, DEFAULT_APP_SETTINGS)
  store.addNotification({ workspaceId: ws.id, tone: 'info', title: 'hi', read: false, dismissed: false })

  store.deleteWorkspace(ws.id)
  assert.equal(store.getWorkspace(ws.id), undefined)
  assert.equal(store.listCollections(ws.id).length, 0)
  assert.equal(store.listFolders(col.id).length, 0)
  assert.equal(store.listEnvironments(ws.id).length, 0)
  assert.equal(store.listMockServers(ws.id).length, 0)
  assert.equal(store.listNotifications(ws.id).length, 0)
  store.close()
})

test('secret values are ciphertext in the raw db file', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const ws = store.createWorkspace({ name: 'Secrets' })
  const wrapped = withSecretCodec(store, sealedCodec())
  wrapped.saveEnvironment({
    ...sampleEnvironment('env_sec', ws.id),
    variables: [
      { id: 'v1', key: 'api_key', initialValue: 'plaintext-key-123', currentValue: 'plaintext-key-123', scope: 'environment', secret: true },
    ],
  })
  store.close()

  const raw = new DatabaseSync(path)
  const row = raw.prepare('SELECT data FROM environments WHERE id = ?').get('env_sec') as { data: string }
  raw.close()
  assert.equal(row.data.includes('plaintext-key-123'), false, 'secret must not appear in db dump')
  const parsed = JSON.parse(row.data) as Environment
  assert.equal(parsed.variables[0]?.currentValue.startsWith('cipher:'), true)
})

test('secret values decrypt correctly through the same codec after reopen', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const ws = store.createWorkspace({ name: 'Secrets2' })
  withSecretCodec(store, sealedCodec()).saveEnvironment({
    ...sampleEnvironment('env_sec2', ws.id),
    variables: [
      { id: 'v1', key: 'token', initialValue: 'token-xyz', currentValue: 'token-xyz', scope: 'environment', secret: true },
    ],
  })
  store.close()

  const reopened = new SQLiteStorage({ path })
  const envs = withSecretCodec(reopened, sealedCodec()).listEnvironments(ws.id)
  assert.equal(envs[0]?.variables[0]?.currentValue, 'token-xyz')
  reopened.close()
})

test('collection variables, folder/collection/request auth, and secret-flagged request fields are also encrypted at rest', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const wrapped = withSecretCodec(store, sealedCodec())
  const ws = store.createWorkspace({ name: 'Auth Secrets' })

  const collection = wrapped.createCollection({
    name: 'Secured',
    workspaceId: ws.id,
    auth: { type: 'bearer', token: 'collection-token-123' },
    variables: [{ id: 'cv1', key: 'apiSecret', initialValue: 'collection-var-secret', currentValue: 'collection-var-secret', scope: 'collection', secret: true }],
  })
  const folder = wrapped.createFolder({
    collectionId: collection.id,
    name: 'Nested',
    requestIds: [],
    auth: { type: 'basic', username: 'folder-user', password: 'folder-password-456' },
  })
  wrapped.saveRequest({
    ...sampleRequest('req_auth_sec', ws.id, collection.id),
    folderId: folder.id,
    auth: { type: 'apiKey', location: 'header', key: 'X-Api-Key', value: 'request-apikey-789' },
    headers: [{ id: 'h1', key: 'X-Secret-Header', value: 'header-secret-abc', enabled: true, secret: true }],
    variables: [{ id: 'rv1', key: 'reqVar', value: 'request-var-secret', enabled: true, secret: true }],
    body: { type: 'x-www-form-urlencoded', pairs: [{ id: 'b1', key: 'password', value: 'body-pair-secret', enabled: true, secret: true }] },
  })
  store.close()

  const raw = new DatabaseSync(path)
  const collRow = raw.prepare('SELECT data FROM collections WHERE id = ?').get(collection.id) as { data: string }
  const folderRow = raw.prepare('SELECT data FROM folders WHERE id = ?').get(folder.id) as { data: string }
  const reqRow = raw.prepare('SELECT data FROM requests WHERE id = ?').get('req_auth_sec') as { data: string }
  raw.close()

  for (const plaintext of [
    'collection-token-123',
    'collection-var-secret',
    'folder-password-456',
    'request-apikey-789',
    'header-secret-abc',
    'request-var-secret',
    'body-pair-secret',
  ]) {
    assert.equal(collRow.data.includes(plaintext), false, `${plaintext} must not be in the raw collections row`)
    assert.equal(folderRow.data.includes(plaintext), false, `${plaintext} must not be in the raw folders row`)
    assert.equal(reqRow.data.includes(plaintext), false, `${plaintext} must not be in the raw requests row`)
  }
  // folder-user (username, not sensitive) SHOULD survive in plaintext — only the password is encrypted.
  assert.equal(folderRow.data.includes('folder-user'), true, 'non-sensitive auth fields should stay plaintext')

  const reopened = new SQLiteStorage({ path })
  const rewrapped = withSecretCodec(reopened, sealedCodec())
  const gotCollection = rewrapped.getCollection(collection.id)
  const gotFolder = rewrapped.listFolders(collection.id)[0]
  const gotRequest = rewrapped.getRequest('req_auth_sec')

  assert.deepEqual(gotCollection?.auth, { type: 'bearer', token: 'collection-token-123' })
  assert.equal(gotCollection?.variables?.[0]?.currentValue, 'collection-var-secret')
  assert.deepEqual(gotFolder?.auth, { type: 'basic', username: 'folder-user', password: 'folder-password-456' })
  assert.deepEqual(gotRequest?.auth, { type: 'apiKey', location: 'header', key: 'X-Api-Key', value: 'request-apikey-789' })
  assert.equal(gotRequest?.headers[0]?.value, 'header-secret-abc')
  assert.equal(gotRequest?.variables[0]?.value, 'request-var-secret')
  assert.equal((gotRequest?.body as { pairs: { value: string }[] }).pairs[0]?.value, 'body-pair-secret')
  reopened.close()
})

test('a pre-existing plaintext auth/collection-variable value (written before this codec wiring existed) still reads back correctly', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const ws = store.createWorkspace({ name: 'Legacy' })
  // Written through the RAW (un-wrapped) store — simulates data saved by an
  // older build that never encrypted these fields.
  const collection = store.createCollection({
    name: 'Legacy Collection',
    workspaceId: ws.id,
    auth: { type: 'bearer', token: 'already-plaintext-token' },
    variables: [{ id: 'v1', key: 'k', initialValue: 'already-plaintext-var', currentValue: 'already-plaintext-var', scope: 'collection', secret: true }],
  })
  store.close()

  const reopened = new SQLiteStorage({ path })
  const wrapped = withSecretCodec(reopened, sealedCodec())
  const got = wrapped.getCollection(collection.id)
  assert.deepEqual(got?.auth, { type: 'bearer', token: 'already-plaintext-token' }, 'decrypt of non-ciphertext falls back to the original value unchanged')
  assert.equal(got?.variables?.[0]?.currentValue, 'already-plaintext-var')
  reopened.close()
})

test('a {{variable}} reference in an auth/header field is never encrypted — only a literal secret is', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const wrapped = withSecretCodec(store, sealedCodec())
  const ws = store.createWorkspace({ name: 'Template Refs' })

  wrapped.saveRequest({
    ...sampleRequest('req_template', ws.id),
    auth: { type: 'bearer', token: '{{authToken}}' },
    headers: [{ id: 'h1', key: 'X-Api-Key', value: '{{apiKey}}', enabled: true, secret: true }],
  })
  wrapped.saveRequest({
    ...sampleRequest('req_literal', ws.id),
    auth: { type: 'bearer', token: 'a-real-hardcoded-token' },
  })
  store.close()

  const raw = new DatabaseSync(path)
  const templateRow = raw.prepare('SELECT data FROM requests WHERE id = ?').get('req_template') as { data: string }
  const literalRow = raw.prepare('SELECT data FROM requests WHERE id = ?').get('req_literal') as { data: string }
  raw.close()

  assert.equal(templateRow.data.includes('{{authToken}}'), true, 'a template reference must stay literally readable, not become ciphertext')
  assert.equal(templateRow.data.includes('{{apiKey}}'), true, 'same for a secret-flagged header that references a variable')
  assert.equal(literalRow.data.includes('a-real-hardcoded-token'), false, 'a real hardcoded secret must still be encrypted')

  const reopened = new SQLiteStorage({ path })
  const rewrapped = withSecretCodec(reopened, sealedCodec())
  assert.deepEqual(rewrapped.getRequest('req_template')?.auth, { type: 'bearer', token: '{{authToken}}' })
  assert.deepEqual(rewrapped.getRequest('req_literal')?.auth, { type: 'bearer', token: 'a-real-hardcoded-token' })
  reopened.close()
})

test('non-sensitive fields are never touched by the codec', () => {
  const path = tempDb()
  const store = new SQLiteStorage({ path })
  const wrapped = withSecretCodec(store, sealedCodec())
  const ws = store.createWorkspace({ name: 'Non-secret' })
  const collection = wrapped.createCollection({
    name: 'C',
    workspaceId: ws.id,
    variables: [{ id: 'v1', key: 'region', initialValue: 'eu-west-1', currentValue: 'eu-west-1', scope: 'collection', secret: false }],
  })
  wrapped.saveRequest({
    ...sampleRequest('req_plain', ws.id, collection.id),
    auth: { type: 'aws', accessKey: 'AKIA_NOT_SECRET', secretKey: 'this-is-secret', region: 'us-east-1', service: 's3' },
  })
  store.close()

  const raw = new DatabaseSync(path)
  const reqRow = raw.prepare('SELECT data FROM requests WHERE id = ?').get('req_plain') as { data: string }
  raw.close()
  assert.equal(reqRow.data.includes('AKIA_NOT_SECRET'), true, 'accessKey is not sensitive and should stay plaintext')
  assert.equal(reqRow.data.includes('us-east-1'), true, 'region is not sensitive and should stay plaintext')
  assert.equal(reqRow.data.includes('this-is-secret'), false, 'secretKey is sensitive and must be encrypted')

  const reopened = new SQLiteStorage({ path })
  const gotCollection = withSecretCodec(reopened, sealedCodec()).getCollection(collection.id)
  assert.equal(gotCollection?.variables?.[0]?.currentValue, 'eu-west-1')
  reopened.close()
})