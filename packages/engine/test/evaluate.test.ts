import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateAssertion, evaluateAssertions } from '../src/index.ts'
import type { Assertion } from '../src/index.ts'
import type { ResponseModel } from '../src/index.ts'

function response(overrides: Partial<ResponseModel> = {}): ResponseModel {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: { data: { id: 'usr_1', status: 'active' }, items: [1, 2, 3] },
    bodyText: '{}',
    size: 10,
    timeMs: 50,
    timing: { dns: 1, connect: 1, tls: 1, wait: 1, download: 1, total: 5 },
    cookies: [],
    redirects: [],
    ...overrides,
  }
}

function assertion(overrides: Partial<Assertion>): Assertion {
  return { id: 'a1', type: 'statusCodeEquals', target: 'status', expected: '200', enabled: true, ...overrides }
}

test('statusCodeEquals passes/fails correctly', () => {
  const res = response({ status: 200 })
  assert.equal(evaluateAssertion(assertion({ type: 'statusCodeEquals', expected: '200' }), res).passed, true)
  assert.equal(evaluateAssertion(assertion({ type: 'statusCodeEquals', expected: '404' }), res).passed, false)
})

test('responseTimeLessThan passes/fails correctly', () => {
  const res = response({ timeMs: 50 })
  assert.equal(evaluateAssertion(assertion({ type: 'responseTimeLessThan', expected: '100' }), res).passed, true)
  assert.equal(evaluateAssertion(assertion({ type: 'responseTimeLessThan', expected: '10' }), res).passed, false)
})

test('jsonPathExists / jsonPathEquals resolve nested paths', () => {
  const res = response()
  assert.equal(
    evaluateAssertion(assertion({ type: 'jsonPathExists', target: '$.data.id' }), res).passed,
    true
  )
  assert.equal(
    evaluateAssertion(assertion({ type: 'jsonPathExists', target: '$.data.missing' }), res).passed,
    false
  )
  assert.equal(
    evaluateAssertion(assertion({ type: 'jsonPathEquals', target: '$.data.status', expected: 'active' }), res)
      .passed,
    true
  )
  assert.equal(
    evaluateAssertion(assertion({ type: 'jsonPathEquals', target: '$.items[1]', expected: '2' }), res).passed,
    true
  )
})

test('headerExists is case-insensitive', () => {
  const res = response({ headers: { 'Content-Type': 'application/json' } })
  assert.equal(evaluateAssertion(assertion({ type: 'headerExists', target: 'content-type' }), res).passed, true)
  assert.equal(evaluateAssertion(assertion({ type: 'headerExists', target: 'x-missing' }), res).passed, false)
})

test('schemaMatches validates the response body against a real JSON schema', () => {
  const schema = JSON.stringify({
    type: 'object',
    required: ['data', 'items'],
    properties: {
      data: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } },
      items: { type: 'array' },
    },
  })
  const result = evaluateAssertion(assertion({ type: 'schemaMatches', target: 'shape', expected: schema }), response())
  assert.equal(result.passed, true)
})

test('schemaMatches fails with a real error message when the body does not match', () => {
  const schema = JSON.stringify({
    type: 'object',
    required: ['nope'],
    properties: { nope: { type: 'string' } },
  })
  const result = evaluateAssertion(assertion({ type: 'schemaMatches', target: 'shape', expected: schema }), response())
  assert.equal(result.passed, false)
  assert.match(result.message, /nope/)
})

test('schemaMatches reports an invalid schema instead of throwing', () => {
  const result = evaluateAssertion(
    assertion({ type: 'schemaMatches', target: 'shape', expected: 'not json at all' }),
    response()
  )
  assert.equal(result.passed, false)
  assert.match(result.message, /Invalid JSON schema/)
})

test('evaluateAssertions skips disabled assertions', () => {
  const results = evaluateAssertions(
    [assertion({ enabled: true }), assertion({ id: 'a2', enabled: false })],
    response()
  )
  assert.equal(results.length, 1)
})
