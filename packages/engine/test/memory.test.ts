import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import {
  InMemoryStorage,
  seedProvider,
  withSecretCodec,
  DEFAULT_APP_SETTINGS,
  type Environment,
  type RequestModel,
  type SecretCodec,
} from '../src/index.ts'

function sealedCodec(salt = 'x'): SecretCodec {
  return {
    isAvailable: () => true,
    encrypt: (plain) => `cipher:${salt}:${Buffer.from(plain, 'utf8').toString('base64')}`,
    decrypt: (payload) => {
      const match = /^cipher:(.+?):(.+)$/.exec(payload)
      if (!match) throw new Error('bad payload')
      return Buffer.from(match[2]!, 'base64').toString('utf8')
    },
  }
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
    name: id.replace(/^env_/, ''),
    phase: 'Development',
    isProduction: false,
    workspaceId,
    variables: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

test('seeds the Acme API demo workspace on construction', () => {
  const store = new InMemoryStorage()
  const workspaces = store.listWorkspaces()
  assert.equal(workspaces.length, 1)
  assert.equal(workspaces[0]!.name, 'Acme API')
  assert.equal(store.listCollections(workspaces[0]!.id).length, 4)
  assert.equal(store.listRequests(workspaces[0]!.id).length, 13)
  assert.equal(store.listEnvironments(workspaces[0]!.id).length, 4)
  assert.equal(store.listGlobalVariables(workspaces[0]!.id).length, 2)
  assert.equal(store.listMockServers(workspaces[0]!.id).length, 1)
  assert.equal(store.listHistory(workspaces[0]!.id).length, 5)
  assert.ok(store.listNotifications(workspaces[0]!.id).length >= 3)
  assert.ok(store.getSettings(workspaces[0]!.id), 'default settings seeded')
})

test('workspace CRUD + rename persists and cascades on delete', () => {
  const store = new InMemoryStorage(false)
  const wsA = store.createWorkspace({ name: 'Alpha' })
  const wsB = store.createWorkspace({ name: 'Beta' })

  const updated = store.updateWorkspace(wsA.id, { name: 'Alpha Renamed' })
  assert.equal(updated?.name, 'Alpha Renamed')
  assert.equal(store.getWorkspace(wsA.id)?.name, 'Alpha Renamed')

  const col = store.createCollection({ name: 'Users', workspaceId: wsA.id })
  const folder = store.createFolder({ collectionId: col.id, name: 'Admin', requestIds: ['req_1'] })
  assert.ok(folder.id)

  store.saveRequest(sampleRequest('req_custom', wsA.id, col.id))
  store.saveEnvironment(sampleEnvironment('env_custom', wsA.id))
  store.saveMockServer({
    id: 'mock_c', name: 'C', workspaceId: wsA.id, port: 4011, status: 'stopped',
    latencyMs: 0, endpoints: [], log: [], createdAt: Date.now(), updatedAt: Date.now(),
  })
  store.saveTestRun({
    id: 'run_c', name: 'R', workspaceId: wsA.id, startedAt: Date.now(),
    iterations: 0, passed: 0, failed: 0, skipped: 0, results: [],
  })
  store.addHistory({
    workspaceId: wsA.id, requestId: 'req_custom', requestName: 'C', method: 'GET',
    url: 'https://x', status: 200, statusText: 'OK', durationMs: 10, timestamp: Date.now(),
  })

  assert.deepEqual(store.listRequests(wsB.id), [], 'requests are workspace-isolated')
  assert.deepEqual(store.listEnvironments(wsB.id), [], 'environments are workspace-isolated')

  store.deleteWorkspace(wsA.id)
  assert.equal(store.getWorkspace(wsA.id), undefined)
  assert.equal(store.listCollections(wsA.id).length, 0)
  assert.equal(store.listFolders(col.id).length, 0)
  assert.equal(store.getRequest('req_custom'), undefined)
  assert.equal(store.listEnvironments(wsA.id).length, 0)
  assert.equal(store.listGlobalVariables(wsA.id).length, 0)
  assert.equal(store.listMockServers(wsA.id).length, 0)
  assert.equal(store.listHistory(wsA.id).length, 0)
  assert.equal(store.listTestRuns(wsA.id).length, 0)
  assert.equal(store.getSettings(wsA.id), undefined)
  assert.equal(store.listWorkspaces().length, 1)
})

test('secret environment values are encrypted at rest and decrypted on read', () => {
  const store = new InMemoryStorage(false)
  const ws = store.createWorkspace({ name: 'Secrets' })
  const wrapped = withSecretCodec(store, sealedCodec())

  const env: Environment = {
    id: 'env_secret',
    name: 'Prod',
    phase: 'Production',
    isProduction: true,
    workspaceId: ws.id,
    variables: [
      { id: 'v1', key: 'token', initialValue: 'super-secret', currentValue: 'super-secret', scope: 'environment', secret: true },
      { id: 'v2', key: 'url', initialValue: 'https://api.example.com', currentValue: 'https://api.example.com', scope: 'environment', secret: false },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  wrapped.saveEnvironment(env)

  const atRest = store.getEnvironment('env_secret')?.variables ?? []
  assert.equal(atRest.find((v) => v.key === 'token')?.currentValue, 'cipher:x:c3VwZXItc2VjcmV0')
  assert.equal(atRest.find((v) => v.key === 'url')?.currentValue, 'https://api.example.com')

  const readBack = wrapped.listEnvironments(ws.id)[0]
  assert.equal(readBack?.variables.find((v) => v.key === 'token')?.currentValue, 'super-secret')
  assert.equal(readBack?.variables.find((v) => v.key === 'url')?.currentValue, 'https://api.example.com')

  wrapped.saveGlobalVariable({
    id: 'g1', key: 'vault', initialValue: 'hidden', currentValue: 'hidden', scope: 'global', secret: true, workspaceId: ws.id,
  })
  assert.equal(store.listGlobalVariables(ws.id)[0]?.currentValue.startsWith('cipher:'), true)
  assert.equal(wrapped.listGlobalVariables(ws.id)[0]?.currentValue, 'hidden')
})

test('codec-unavailable provider stores plaintext (secretsSupported=false path)', () => {
  const store = new InMemoryStorage(false)
  const ws = store.createWorkspace({ name: 'NoKeyring' })
  const wrapped = withSecretCodec(store, {
    isAvailable: () => false,
    encrypt: (p) => p,
    decrypt: (p) => p,
  })
  wrapped.saveEnvironment({ ...sampleEnvironment('env_plain', ws.id), variables: [
    { id: 'v1', key: 'token', initialValue: 'tok123', currentValue: 'tok123', scope: 'environment', secret: true },
  ] })
  assert.equal(store.getEnvironment('env_plain')?.variables[0]?.currentValue, 'tok123')
})

test('seedProvider can populate an otherwise empty provider', () => {
  const store = new InMemoryStorage(false)
  assert.equal(store.listWorkspaces().length, 0)
  const ws = seedProvider(store)
  assert.equal(ws.name, 'Acme API')
  assert.equal(store.listRequests(ws.id).length, 13)
  assert.deepEqual(store.getSettings(ws.id), DEFAULT_APP_SETTINGS)
})