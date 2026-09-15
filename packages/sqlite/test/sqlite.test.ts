import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { SQLiteStorage } from '../src/index'
import type { Environment, RequestModel, SecretCodec } from '../../engine/src/index'
import { withSecretCodec, seedProvider, DEFAULT_APP_SETTINGS } from '../../engine/src/index'

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
  return join(mkdtempSync(join(tmpdir(), 'apiforge-')), 'test.db')
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