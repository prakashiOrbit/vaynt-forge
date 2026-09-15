import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  parsePostmanCollection,
  parseHar,
  parseCurlCommand,
  exportCollectionNative,
  exportCollectionPostman,
  exportCollectionOpenApi,
  parseOpenApiSpec,
  parseDotEnv,
  stringifyDotEnv,
  createDraftRequest,
} from '../src/index.ts'
import type { Collection, RequestModel } from '../src/index.ts'

/* ------------------------------- Postman import ------------------------------- */

test('parsePostmanCollection rejects a document with no info/item', () => {
  assert.throws(() => parsePostmanCollection({}), /valid Postman collection/)
})

test('parsePostmanCollection flattens nested folders into "Parent / Child" tags', () => {
  const plan = parsePostmanCollection({
    info: { name: 'My API' },
    item: [
      {
        name: 'Users',
        item: [
          { name: 'Get User', request: { method: 'GET', url: 'https://api.acme.dev/users/{{id}}' } },
          {
            name: 'Admin',
            item: [{ name: 'Ban User', request: { method: 'POST', url: 'https://api.acme.dev/users/{{id}}/ban' } }],
          },
        ],
      },
      { name: 'Health', request: { method: 'GET', url: 'https://api.acme.dev/health' } },
    ],
  })
  assert.equal(plan.name, 'My API')
  const tags = plan.groups.map((g) => g.tag).sort()
  // A bare top-level request (no wrapping folder) has no natural tag, so it
  // falls back to "General" — same convention OpenAPI import uses for
  // untagged operations.
  assert.deepEqual(tags, ['General', 'Users', 'Users / Admin'])
  assert.equal(plan.groups.find((g) => g.tag === 'General')?.requests[0]?.name, 'Health')
})

test('parsePostmanCollection converts headers, urlencoded body, and bearer auth', () => {
  const plan = parsePostmanCollection({
    info: { name: 'X' },
    item: [
      {
        name: 'Login',
        request: {
          method: 'POST',
          url: 'https://api.acme.dev/login',
          header: [{ key: 'X-Debug', value: 'true' }],
          body: { mode: 'urlencoded', urlencoded: [{ key: 'user', value: 'sarah' }] },
          auth: { type: 'bearer', bearer: [{ key: 'token', value: 'tok_123' }] },
        },
      },
    ],
  })
  const req = plan.groups[0]!.requests[0]!
  assert.equal(req.headers[0]?.key, 'X-Debug')
  assert.equal(req.body.type, 'x-www-form-urlencoded')
  assert.equal(req.auth.type, 'bearer')
  assert.equal((req.auth as { token: string }).token, 'tok_123')
})

/* ---------------------------------- HAR import --------------------------------- */

test('parseHar rejects a non-HAR document', () => {
  assert.throws(() => parseHar({ foo: 'bar' }), /valid HAR/)
})

test('parseHar extracts method/url/status/duration from real entries', () => {
  const drafts = parseHar({
    log: {
      entries: [
        {
          startedDateTime: '2024-01-01T00:00:00.000Z',
          time: 123.7,
          request: { method: 'get', url: 'https://api.acme.dev/users' },
          response: { status: 200, statusText: 'OK', content: { size: 512 } },
        },
      ],
    },
  })
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0]?.method, 'GET')
  assert.equal(drafts[0]?.status, 200)
  assert.equal(drafts[0]?.durationMs, 124)
  assert.equal(drafts[0]?.size, 512)
})

test('parseHar skips malformed entries instead of throwing', () => {
  const drafts = parseHar({ log: { entries: [{ request: {} }, { request: { method: 'GET', url: 'https://x' }, response: { status: 200 } }] } })
  assert.equal(drafts.length, 1)
})

/* --------------------------------- cURL import --------------------------------- */

test('parseCurlCommand extracts method, headers, and JSON body', () => {
  const result = parseCurlCommand(
    `curl -X POST 'https://api.acme.dev/v1/orders' -H 'Content-Type: application/json' -H 'Authorization: Bearer tok' -d '{"sku":"acme-1"}'`
  )
  assert.equal(result.method, 'POST')
  assert.equal(result.url, 'https://api.acme.dev/v1/orders')
  assert.equal(result.headers.length, 2)
  assert.equal(result.body.type, 'raw')
  assert.equal((result.body as { content: string }).content, '{"sku":"acme-1"}')
})

test('parseCurlCommand defaults to GET with no -d, POST with a body and no -X', () => {
  assert.equal(parseCurlCommand(`curl https://api.acme.dev/x`).method, 'GET')
  assert.equal(parseCurlCommand(`curl https://api.acme.dev/x -d 'a=1'`).method, 'POST')
})

test('parseCurlCommand extracts basic auth from -u', () => {
  const result = parseCurlCommand(`curl -u admin:secret https://api.acme.dev/x`)
  assert.deepEqual(result.basicAuth, { username: 'admin', password: 'secret' })
})

test('parseCurlCommand throws when no URL is present', () => {
  assert.throws(() => parseCurlCommand('curl -X GET'), /URL/)
})

/* -------------------------------- Collection export ------------------------------ */

function collection(): Collection {
  return { id: 'col_1', workspaceId: 'ws_1', name: 'Acme', description: 'desc', createdAt: 0, updatedAt: 0 }
}

function request(overrides: Partial<RequestModel> = {}): RequestModel {
  return { ...createDraftRequest({ id: 'req_1', workspaceId: 'ws_1', url: 'https://api.acme.dev/v1/users/{{id}}' }), ...overrides }
}

test('exportCollectionNative round-trips name/description/requests', () => {
  const out = exportCollectionNative(collection(), [request()])
  assert.equal(out.format, 'vaynt-forge-collection')
  assert.equal(out.collection.name, 'Acme')
  assert.equal(out.requests.length, 1)
})

test('exportCollectionPostman produces an item per request with method/url', () => {
  const out = exportCollectionPostman(collection(), [request({ method: 'POST' })]) as { item: { request: { method: string; url: { raw: string } } }[] }
  assert.equal(out.item[0]?.request.method, 'POST')
  assert.equal(out.item[0]?.request.url.raw, 'https://api.acme.dev/v1/users/{{id}}')
})

test('exportCollectionOpenApi produces a spec that this app’s own parser accepts', async () => {
  const spec = exportCollectionOpenApi(collection(), [request({ method: 'GET' })])
  const parsed = parseOpenApiSpec(spec as Record<string, unknown>)
  assert.equal(parsed.info.title, 'Acme')
  assert.ok(parsed.operations.some((op) => op.method === 'GET' && op.path === '/v1/users/{id}'))
})

/* --------------------------------- dotenv export --------------------------------- */

test('stringifyDotEnv output re-parses to the same entries', () => {
  const entries = [
    { key: 'API_URL', value: 'https://api.acme.dev' },
    { key: 'NOTE', value: 'has spaces and #hash' },
  ]
  const text = stringifyDotEnv(entries)
  assert.deepEqual(parseDotEnv(text), entries)
})
