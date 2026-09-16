import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_OPENAPI_YAML } from '../src/storage/seed.ts'
import { parseOpenApiText, parseOpenApiSpec } from '../src/index.ts'

test('parses the demo YAML spec into all 13 seeded operations', () => {
  const doc = parseOpenApiText(DEMO_OPENAPI_YAML)
  const spec = parseOpenApiSpec(doc)
  assert.equal(spec.info.title, 'Acme API')
  assert.equal(spec.operations.length, 13)
  assert.deepEqual(
    spec.tags.map((t) => t.name),
    ['Authentication', 'Users', 'Orders', 'Payments']
  )
  const login = spec.operations.find((o) => o.operationId === 'login')
  assert.ok(login)
  assert.equal(login!.method, 'POST')
  assert.equal(login!.path, '/auth/login')
  assert.ok(login!.requestBody?.example?.includes('sarah.chen@acme.dev'))
})

test('parses a plain JSON document too', () => {
  const json = JSON.stringify({
    openapi: '3.0.3',
    info: { title: 'Tiny API', version: '1.0.0' },
    paths: {
      '/ping': { get: { operationId: 'ping', responses: { '200': { description: 'ok' } } } },
    },
  })
  const doc = parseOpenApiText(json)
  const spec = parseOpenApiSpec(doc)
  assert.equal(spec.info.title, 'Tiny API')
  assert.equal(spec.operations.length, 1)
  assert.equal(spec.operations[0]?.path, '/ping')
})

test('operations with no tags fall back to "General"', () => {
  const doc = parseOpenApiText(
    JSON.stringify({
      info: { title: 'X', version: '1' },
      paths: { '/x': { get: { responses: {} } } },
    })
  )
  const spec = parseOpenApiSpec(doc)
  assert.deepEqual(spec.operations[0]?.tags, ['General'])
})

test('resolves a local $ref in a response schema', () => {
  const doc = parseOpenApiText(
    JSON.stringify({
      info: { title: 'X', version: '1' },
      components: {
        schemas: {
          User: { type: 'object', properties: { id: { type: 'string' } } },
        },
      },
      paths: {
        '/users/{id}': {
          get: {
            operationId: 'getUser',
            responses: {
              '200': {
                description: 'ok',
                content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } },
              },
            },
          },
        },
      },
    })
  )
  const spec = parseOpenApiSpec(doc)
  const op = spec.operations[0]!
  const content = op.responses[0]!.content[0]!
  assert.deepEqual(content.schema, { type: 'object', properties: { id: { type: 'string' } } })
  // Synthesized example should reflect the resolved schema's shape, not a raw $ref.
  assert.deepEqual(JSON.parse(content.example ?? '{}'), { id: 'string' })
})

test('malformed input throws rather than silently returning garbage', () => {
  assert.throws(() => parseOpenApiText('{ this is not valid json or yaml: ['))
})

test('a native OpenAPI document is tagged with sourceDialect "openapi"', () => {
  const doc = parseOpenApiText(JSON.stringify({ openapi: '3.0.3', info: { title: 'X', version: '1' }, paths: {} }))
  const spec = parseOpenApiSpec(doc)
  assert.equal(spec.sourceDialect, 'openapi')
})

test('OpenAPI 3.1-style `type: [X, "null"]` schemas synthesize the same example an equivalent 3.0 `nullable: true` schema would', () => {
  const doc = parseOpenApiText(
    JSON.stringify({
      openapi: '3.1.0',
      info: { title: 'X', version: '1' },
      paths: {
        '/widgets/{id}': {
          get: {
            operationId: 'getWidget',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: ['string', 'null'] } }],
            responses: {
              '200': {
                description: 'ok',
                content: {
                  'application/json': {
                    schema: {
                      type: ['object', 'null'],
                      properties: {
                        count: { type: ['integer', 'null'] },
                        tags: { type: ['array', 'null'], items: { type: 'string' } },
                        active: { type: ['boolean', 'null'] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
  )
  const spec = parseOpenApiSpec(doc)
  const op = spec.operations[0]!
  assert.equal(op.parameters[0]?.schemaType, 'string')
  const example = JSON.parse(op.responses[0]!.content[0]!.example ?? '{}')
  assert.deepEqual(example, { count: 0, tags: ['string'], active: true })
})
