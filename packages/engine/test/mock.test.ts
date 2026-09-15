import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchMockEndpoint } from '../src/index.ts'
import type { MockEndpoint } from '../src/index.ts'

const endpoint = (method: string, path: string): MockEndpoint => ({
  id: `${method}-${path}`,
  method,
  path,
  status: 200,
  headers: {},
  body: '{}',
  delayMs: 0,
  errorRate: 0,
})

test('matches an exact static path and method', () => {
  const endpoints = [endpoint('GET', '/users'), endpoint('POST', '/users')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users')
  assert.equal(match?.id, 'GET-/users')
})

test('matches a :param segment against a real value', () => {
  const endpoints = [endpoint('GET', '/users/:id')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users/usr_1')
  assert.equal(match?.id, 'GET-/users/:id')
})

test('does not match a :param path against extra trailing segments', () => {
  const endpoints = [endpoint('GET', '/users/:id')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users/usr_1/orders')
  assert.equal(match, undefined)
})

test('method mismatch does not match even with an identical path', () => {
  const endpoints = [endpoint('POST', '/users')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users')
  assert.equal(match, undefined)
})

test('ignores a query string when matching the path', () => {
  const endpoints = [endpoint('GET', '/users')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users?page=1&limit=20')
  assert.equal(match?.id, 'GET-/users')
})

test('no configured endpoint matches an unknown path', () => {
  const endpoints = [endpoint('GET', '/users')]
  const match = matchMockEndpoint(endpoints, 'GET', '/orders')
  assert.equal(match, undefined)
})

test('first matching endpoint wins when two could match', () => {
  const endpoints = [endpoint('GET', '/users/:id'), endpoint('GET', '/users/me')]
  const match = matchMockEndpoint(endpoints, 'GET', '/users/me')
  assert.equal(match?.id, 'GET-/users/:id')
})
