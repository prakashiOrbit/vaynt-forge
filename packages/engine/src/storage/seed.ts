import type { Workspace, Collection } from '../types/workspace'
import type { RequestModel } from '../types/request'
import type { Environment } from '../types/variables'
import type { MockServer } from '../types/mock'

export const DEMO_WORKSPACE: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'Acme API',
  description: 'Sample workspace — users, orders, payments.',
  isDemo: true,
}

export const DEMO_COLLECTIONS: Omit<Collection, 'id' | 'createdAt' | 'updatedAt'>[] = [
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