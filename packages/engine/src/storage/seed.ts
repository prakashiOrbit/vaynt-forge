import type { Workspace } from '../types/workspace'
import type { RequestModel } from '../types/request'
import type { Variable, Environment } from '../types/variables'
import type { MockServer } from '../types/mock'
import type { StorageProvider, CollectionDraft, HistoryInput, NotificationDraft } from './provider'
import type { AppNotification } from '../types/notifications'
import { DEFAULT_APP_SETTINGS } from '../types/settings'

export const DEMO_WORKSPACE: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Acme API',
  description: 'Sample workspace — users, orders, payments.',
  isDemo: true,
}

export const DEMO_COLLECTIONS: CollectionDraft[] = [
  { name: 'Authentication', workspaceId: '' },
  { name: 'Users', workspaceId: '' },
  { name: 'Orders', workspaceId: '' },
  { name: 'Payments', workspaceId: '' },
]

const baseRequest = (
  id: string,
  name: string,
  method: RequestModel['method'],
  url: string
): RequestModel => ({
  id,
  name,
  method,
  url,
  workspaceId: '',
  params: [],
  headers: [
    { id: `${id}_h1`, key: 'Content-Type', value: 'application/json', enabled: true },
    { id: `${id}_h2`, key: 'Authorization', value: 'Bearer {{access_token}}', enabled: true },
  ],
  auth: { type: 'bearer', token: '{{access_token}}' },
  body: { type: 'none' },
  scripts: { preRequest: '', postResponse: '' },
  assertions: [
    { id: `${id}_a1`, type: 'statusCodeEquals', target: 'status', expected: '200', enabled: true },
  ],
  settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true },
  variables: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
})

export const DEMO_REQUESTS: (RequestModel & { collectionName: string })[] = [
  {
    ...baseRequest('req_login', 'Login', 'POST', 'https://api.acme.dev/v1/auth/login'),
    collectionName: 'Authentication',
    body: {
      type: 'raw',
      language: 'json',
      content: '{\n  "email": "sarah.chen@acme.dev",\n  "password": "{{$guid}}"\n}',
    },
  },
  { ...baseRequest('req_token', 'Refresh Token', 'POST', 'https://api.acme.dev/v1/auth/refresh'), collectionName: 'Authentication' },
  { ...baseRequest('req_logout', 'Logout', 'POST', 'https://api.acme.dev/v1/auth/logout'), collectionName: 'Authentication' },
  {
    ...baseRequest('req_get_users', 'Get User', 'GET', 'https://api.acme.dev/v1/users?page=1&limit=20'),
    collectionName: 'Users',
  },
  { ...baseRequest('req_create_user', 'Create User', 'POST', 'https://api.acme.dev/v1/users'), collectionName: 'Users' },
  {
    ...baseRequest('req_get_user', 'Get User Detail', 'GET', 'https://api.acme.dev/v1/users/{{userId}}'),
    collectionName: 'Users',
  },
  { ...baseRequest('req_update_user', 'Update User', 'PATCH', 'https://api.acme.dev/v1/users/{{userId}}'), collectionName: 'Users' },
  { ...baseRequest('req_delete_user', 'Delete User', 'DELETE', 'https://api.acme.dev/v1/users/{{userId}}'), collectionName: 'Users' },
  { ...baseRequest('req_create_order', 'Create Order', 'POST', 'https://api.acme.dev/v1/orders'), collectionName: 'Orders' },
  { ...baseRequest('req_get_order', 'Get Order', 'GET', 'https://api.acme.dev/v1/orders/{{orderId}}'), collectionName: 'Orders' },
  { ...baseRequest('req_cancel_order', 'Cancel Order', 'DELETE', 'https://api.acme.dev/v1/orders/{{orderId}}'), collectionName: 'Orders' },
  { ...baseRequest('req_create_payment', 'Create Payment', 'POST', 'https://api.acme.dev/v1/payments'), collectionName: 'Payments' },
  { ...baseRequest('req_get_payment', 'Get Payment', 'GET', 'https://api.acme.dev/v1/payments/{{paymentId}}'), collectionName: 'Payments' },
]

export const DEMO_ENVIRONMENTS: Omit<Environment, 'workspaceId'>[] = [
  {
    id: 'env_dev',
    name: 'Development',
    phase: 'Development',
    isProduction: false,
    variables: [
      { id: 'v_dev1', key: 'api_url', initialValue: 'http://localhost:8080', currentValue: 'http://localhost:8080', scope: 'environment', secret: false },
      { id: 'v_dev2', key: 'access_token', initialValue: 'dev-token-abc', currentValue: 'dev-token-abc', scope: 'environment', secret: true },
      { id: 'v_dev3', key: 'client_id', initialValue: 'acme-web', currentValue: 'acme-web', scope: 'environment', secret: false },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'env_test',
    name: 'Test',
    phase: 'Test',
    isProduction: false,
    variables: [
      { id: 'v_test1', key: 'api_url', initialValue: 'https://test-api.acme.dev', currentValue: 'https://test-api.acme.dev', scope: 'environment', secret: false },
      { id: 'v_test2', key: 'access_token', initialValue: 'test-token-xyz', currentValue: 'test-token-xyz', scope: 'environment', secret: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'env_staging',
    name: 'Staging',
    phase: 'Staging',
    isProduction: false,
    variables: [
      { id: 'v_st1', key: 'api_url', initialValue: 'https://staging-api.acme.dev', currentValue: 'https://staging-api.acme.dev', scope: 'environment', secret: false },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'env_prod',
    name: 'Production',
    phase: 'Production',
    isProduction: true,
    variables: [
      { id: 'v_pr1', key: 'api_url', initialValue: 'https://api.acme.dev', currentValue: 'https://api.acme.dev', scope: 'environment', secret: false },
      { id: 'v_pr2', key: 'access_token', initialValue: 'prod-token-secret', currentValue: 'prod-token-secret', scope: 'environment', secret: true },
    ],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
]

export const DEMO_GLOBAL_VARIABLES: Omit<Variable, 'workspaceId'>[] = [
  { id: 'v_global1', key: 'org_id', initialValue: 'acme-org-001', currentValue: 'acme-org-001', scope: 'global', secret: false },
  { id: 'v_global2', key: 'replica', initialValue: 'us-east-1', currentValue: 'us-east-1', scope: 'global', secret: false },
]

export const DEMO_MOCK: MockServer = {
  id: 'mock_users',
  name: 'User API Mock',
  workspaceId: '',
  port: 4010,
  status: 'stopped',
  latencyMs: 120,
  endpoints: [
    { id: 'me1', method: 'GET', path: '/users', status: 200, headers: { 'content-type': 'application/json' }, body: '[{ "id": "usr_1", "name": "Sarah Chen" }]', delayMs: 100, errorRate: 0.05 },
    { id: 'me2', method: 'POST', path: '/users', status: 201, headers: { 'content-type': 'application/json' }, body: '{ "created": true }', delayMs: 150, errorRate: 0 },
    { id: 'me3', method: 'GET', path: '/users/:id', status: 200, headers: { 'content-type': 'application/json' }, body: '{ "id": "usr_1", "name": "Sarah Chen" }', delayMs: 80, errorRate: 0.02 },
  ],
  log: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export const DEMO_NOTIFICATIONS: NotificationDraft[] = [
  {
    workspaceId: '',
    tone: 'success',
    title: 'Mock server started',
    message: 'Acme API › CRUD on port 4010',
    read: false,
    dismissed: false,
  },
  {
    workspaceId: '',
    tone: 'warning',
    title: 'Environment switched to Production',
    message: 'Requests will run against the live API.',
    read: false,
    dismissed: false,
  },
  {
    workspaceId: '',
    tone: 'info',
    title: 'Collection synced',
    message: 'Users Collection · 12 requests',
    read: true,
    dismissed: false,
  },
]

const SEED_HISTORY: Omit<HistoryInput, 'workspaceId' | 'timestamp'>[] = [
  { requestId: 'req_get_users', requestName: 'Get User', method: 'GET', url: 'https://api.acme.dev/v1/users?page=1&limit=20', status: 200, statusText: 'OK', durationMs: 124, size: 224, environmentId: 'env_dev' },
  { requestId: 'req_login', requestName: 'Login', method: 'POST', url: 'https://api.acme.dev/v1/auth/login', status: 200, statusText: 'OK', durationMs: 238, size: 512, environmentId: 'env_dev' },
  { requestId: 'req_get_user', requestName: 'Get User Detail', method: 'GET', url: 'https://api.acme.dev/v1/users/usr_1024', status: 200, statusText: 'OK', durationMs: 81, size: 180, environmentId: 'env_dev' },
  { requestId: 'req_create_order', requestName: 'Create Order', method: 'POST', url: 'https://api.acme.dev/v1/orders', status: 500, statusText: 'Internal Server Error', durationMs: 923, size: 92, environmentId: 'env_dev' },
  { requestId: 'req_get_order', requestName: 'Get Order', method: 'GET', url: 'https://api.acme.dev/v1/orders/ord_901', status: 200, statusText: 'OK', durationMs: 156, size: 340, environmentId: 'env_dev' },
]

/**
 * Populates an empty provider with the "Acme API" demo workspace. Used by both
 * `InMemoryStorage` (default) and `SQLiteStorage` on first launch so the two
 * implementations stay behaviour-identical.
 */
export function seedProvider(provider: StorageProvider): Workspace {
  const ws = provider.createWorkspace(DEMO_WORKSPACE)

  const collectionIdByName = new Map<string, string>()
  for (const col of DEMO_COLLECTIONS) {
    const created = provider.createCollection({ ...col, workspaceId: ws.id })
    collectionIdByName.set(created.name, created.id)
  }

  for (const req of DEMO_REQUESTS) {
    const { collectionName, ...request } = req
    provider.saveRequest({ ...request, workspaceId: ws.id, collectionId: collectionIdByName.get(collectionName) })
  }

  for (const env of DEMO_ENVIRONMENTS) {
    provider.saveEnvironment({ ...env, workspaceId: ws.id })
  }
  for (const v of DEMO_GLOBAL_VARIABLES) {
    provider.saveGlobalVariable({ ...v, workspaceId: ws.id, scope: 'global' })
  }
  provider.saveMockServer({ ...DEMO_MOCK, workspaceId: ws.id })

  const now = Date.now()
  SEED_HISTORY.forEach((h, i) => {
    provider.addHistory({ ...h, workspaceId: ws.id, timestamp: now - (i + 1) * 4 * 60_000 })
  })
  for (const n of DEMO_NOTIFICATIONS) {
    provider.addNotification({ ...n, workspaceId: ws.id })
  }

  provider.saveSettings(ws.id, DEFAULT_APP_SETTINGS)

  return ws
}

export type { AppNotification }
export type { Workspace }