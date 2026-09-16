import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseOpenApiText, parseOpenApiSpec, planCollectionFromSpec } from '../src/index.ts'

const PETSTORE_SWAGGER2 = {
  swagger: '2.0',
  info: { title: 'Petstore', version: '1.0.0' },
  host: 'api.example.com',
  basePath: '/v1',
  schemes: ['https'],
  consumes: ['application/json'],
  produces: ['application/json'],
  securityDefinitions: {
    ApiKeyAuth: { type: 'apiKey', name: 'X-API-Key', in: 'header' },
    BasicAuth: { type: 'basic' },
  },
  definitions: {
    Pet: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } },
  },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['Pets'],
        parameters: [{ name: 'limit', in: 'query', required: false, type: 'integer' }],
        responses: {
          '200': { description: 'ok', schema: { type: 'array', items: { $ref: '#/definitions/Pet' } } },
        },
      },
      post: {
        operationId: 'createPet',
        tags: ['Pets'],
        parameters: [{ name: 'body', in: 'body', required: true, schema: { $ref: '#/definitions/Pet' } }],
        responses: {
          '201': { description: 'created', schema: { $ref: '#/definitions/Pet' } },
        },
      },
    },
    '/pets/upload-photo': {
      post: {
        operationId: 'uploadPhoto',
        tags: ['Pets'],
        consumes: ['multipart/form-data'],
        parameters: [
          { name: 'petId', in: 'formData', required: true, type: 'string' },
          { name: 'file', in: 'formData', required: true, type: 'file' },
        ],
        responses: { '200': { description: 'ok' } },
      },
    },
  },
}

test('a Swagger 2.0 document is tagged with sourceDialect "swagger2"', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  assert.equal(spec.sourceDialect, 'swagger2')
})

test('host/basePath/schemes synthesize a servers[] entry', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  assert.deepEqual(spec.servers, [{ url: 'https://api.example.com/v1', description: undefined }])
})

test('securityDefinitions normalizes into securitySchemes, remapping "basic" to http/basic', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  const apiKey = spec.securitySchemes.find((s) => s.name === 'ApiKeyAuth')
  const basic = spec.securitySchemes.find((s) => s.name === 'BasicAuth')
  assert.equal(apiKey?.type, 'apiKey')
  assert.equal(apiKey?.in, 'header')
  assert.equal(basic?.type, 'http')
  assert.equal(basic?.scheme, 'basic')
})

test('an `in: "body"` parameter becomes the operation\'s requestBody, with the local $ref resolved', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  const createPet = spec.operations.find((o) => o.operationId === 'createPet')!
  assert.equal(createPet.parameters.length, 0, 'the body parameter should not leak through as a query/header param')
  assert.equal(createPet.requestBody?.contentType, 'application/json')
  assert.deepEqual(createPet.requestBody?.schema, { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } })
})

test('a top-level array `schema` response (no `content` wrapper) synthesizes an example resolving its nested $ref', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  const listPets = spec.operations.find((o) => o.operationId === 'listPets')!
  const content = listPets.responses[0]!.content[0]!
  assert.equal(content.contentType, 'application/json')
  assert.deepEqual(content.schema, { type: 'array', items: { $ref: '#/definitions/Pet' } })
  assert.deepEqual(JSON.parse(content.example ?? '[]'), [{ id: 0, name: 'string' }])
})

test('"formData" parameters (with a multipart consumes) become a synthesized object requestBody', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  const upload = spec.operations.find((o) => o.operationId === 'uploadPhoto')!
  assert.equal(upload.parameters.length, 0)
  assert.equal(upload.requestBody?.contentType, 'multipart/form-data')
  const schema = upload.requestBody?.schema as { properties: Record<string, unknown>; required: string[] }
  assert.deepEqual(Object.keys(schema.properties).sort(), ['file', 'petId'])
  assert.deepEqual(schema.required.sort(), ['file', 'petId'])
})

test('a normalized Swagger 2.0 spec plans a real, sendable collection end to end', () => {
  const spec = parseOpenApiSpec(parseOpenApiText(JSON.stringify(PETSTORE_SWAGGER2)))
  const plan = planCollectionFromSpec(spec, spec.servers[0]!.url)
  assert.equal(plan.name, 'Petstore')
  const pets = plan.groups.find((g) => g.tag === 'Pets')!
  const createPet = pets.requests.find((r) => r.method === 'POST' && r.url.endsWith('/pets'))!
  assert.equal(createPet.body.type, 'raw')
  assert.ok(createPet.body.type === 'raw' && createPet.body.content.includes('"id"'))
})
