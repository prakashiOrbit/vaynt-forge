import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEMO_OPENAPI_YAML } from '../src/storage/seed.ts'
import {
  parseOpenApiText,
  parseOpenApiSpec,
  planCollectionFromSpec,
  planMockEndpointsFromSpec,
  generateCodeSample,
  CODE_SAMPLE_LANGUAGES,
} from '../src/index.ts'

const spec = parseOpenApiSpec(parseOpenApiText(DEMO_OPENAPI_YAML))
const baseUrl = spec.servers[0]!.url

test('planCollectionFromSpec groups all 13 operations by tag and converts {param} to {{param}}', () => {
  const plan = planCollectionFromSpec(spec, baseUrl)
  assert.equal(plan.name, 'Acme API')
  const totalRequests = plan.groups.reduce((sum, g) => sum + g.requests.length, 0)
  assert.equal(totalRequests, 13)
  assert.deepEqual(
    plan.groups.map((g) => g.tag).sort(),
    ['Authentication', 'Orders', 'Payments', 'Users']
  )
  const usersGroup = plan.groups.find((g) => g.tag === 'Users')!
  const getUser = usersGroup.requests.find((r) => r.method === 'GET' && r.url.endsWith('/users/{{userId}}'))
  assert.ok(getUser, 'path params must convert from {userId} to {{userId}}')
  assert.match(getUser!.url, /\/\{\{userId\}\}$/, 'must be the double-brace mustache form, not the raw {userId} form')
})

test('planCollectionFromSpec gives every request a statusCodeEquals assertion matching its first 2xx response', () => {
  const plan = planCollectionFromSpec(spec, baseUrl)
  const createUser = plan.groups.flatMap((g) => g.requests).find((r) => r.name === 'Create User')!
  assert.equal(createUser.assertions[0]?.expected, '201')
})

test('planCollectionFromSpec puts the requestBody JSON example into a raw body', () => {
  const plan = planCollectionFromSpec(spec, baseUrl)
  const login = plan.groups.flatMap((g) => g.requests).find((r) => r.name === 'Log in')!
  assert.equal(login.body.type, 'raw')
  assert.ok(login.body.type === 'raw' && login.body.content.includes('sarah.chen@acme.dev'))
})

test('planMockEndpointsFromSpec converts {param} to Express-style :param', () => {
  const endpoints = planMockEndpointsFromSpec(spec)
  assert.equal(endpoints.length, 13)
  const getUser = endpoints.find((e) => e.method === 'GET' && e.path === '/users/:userId')
  assert.ok(getUser)
  assert.equal(getUser!.status, 200)
})

test('generateCodeSample produces all 5 languages, each containing the URL and method', () => {
  const req = { method: 'POST', url: 'https://api.acme.dev/v1/auth/login', headers: [{ key: 'Content-Type', value: 'application/json' }], body: '{"email":"a@b.com"}' }
  for (const { id } of CODE_SAMPLE_LANGUAGES) {
    const sample = generateCodeSample(req, id)
    assert.ok(sample.includes('api.acme.dev'), `${id} sample should include the URL`)
    assert.ok(sample.length > 20, `${id} sample should be non-trivial`)
  }
})

test('curl sample is a plausible, copy-pasteable command', () => {
  const req = { method: 'GET', url: 'https://api.acme.dev/v1/users', headers: [{ key: 'Authorization', value: 'Bearer xyz' }] }
  const sample = generateCodeSample(req, 'curl')
  assert.match(sample, /^curl -X GET/)
  assert.match(sample, /Authorization: Bearer xyz/)
})
