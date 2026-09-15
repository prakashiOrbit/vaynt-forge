import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffLines, linesAreIdentical, compareRequests, compareResponses } from '../src/index.ts'
import type { RequestModel, ResponseModel } from '../src/index.ts'
import { createDraftRequest } from '../src/index.ts'

test('diffLines marks identical text as all "same"', () => {
  const lines = diffLines('a\nb\nc', 'a\nb\nc')
  assert.equal(linesAreIdentical(lines), true)
  assert.ok(lines.every((l) => l.type === 'same'))
})

test('diffLines detects an added line', () => {
  const lines = diffLines('a\nb', 'a\nb\nc')
  assert.equal(linesAreIdentical(lines), false)
  assert.deepEqual(
    lines.filter((l) => l.type !== 'same').map((l) => l.text),
    ['c']
  )
})

test('diffLines detects a removed line', () => {
  const lines = diffLines('a\nb\nc', 'a\nc')
  const removed = lines.filter((l) => l.type === 'removed')
  assert.deepEqual(removed.map((l) => l.text), ['b'])
})

test('diffLines detects a changed line as a remove+add pair', () => {
  const lines = diffLines('hello world', 'hello there')
  assert.ok(lines.some((l) => l.type === 'removed' && l.text === 'hello world'))
  assert.ok(lines.some((l) => l.type === 'added' && l.text === 'hello there'))
})

function request(overrides: Partial<RequestModel> = {}): RequestModel {
  return { ...createDraftRequest({ id: 'req_a', workspaceId: 'ws_1' }), ...overrides }
}

test('compareRequests reports identical URL/method/headers/params/body as identical', () => {
  const a = request({ url: 'https://api.acme.dev/users', method: 'GET' })
  const b = request({ url: 'https://api.acme.dev/users', method: 'GET' })
  const diff = compareRequests(a, b)
  assert.equal(diff.url.identical, true)
  assert.equal(diff.method.identical, true)
  assert.equal(diff.headers.identical, true)
  assert.equal(diff.body.identical, true)
})

test('compareRequests flags a different URL and method', () => {
  const a = request({ url: 'https://api.acme.dev/users', method: 'GET' })
  const b = request({ url: 'https://api.acme.dev/orders', method: 'POST' })
  const diff = compareRequests(a, b)
  assert.equal(diff.url.identical, false)
  assert.equal(diff.method.identical, false)
})

test('compareRequests diffs headers by key, ignoring order and disabled rows', () => {
  const a = request({
    headers: [
      { id: '1', key: 'Accept', value: 'application/json', enabled: true },
      { id: '2', key: 'X-Debug', value: 'true', enabled: false },
    ],
  })
  const b = request({
    headers: [{ id: '3', key: 'Accept', value: 'application/json', enabled: true }],
  })
  assert.equal(compareRequests(a, b).headers.identical, true)
})

test('compareRequests diffs raw body content', () => {
  const a = request({ body: { type: 'raw', language: 'json', content: '{"a":1}' } })
  const b = request({ body: { type: 'raw', language: 'json', content: '{"a":2}' } })
  const diff = compareRequests(a, b)
  assert.equal(diff.body.identical, false)
})

function response(overrides: Partial<ResponseModel> = {}): ResponseModel {
  return {
    status: 200,
    statusText: 'OK',
    headers: {},
    bodyText: '',
    size: 0,
    timeMs: 0,
    timing: { dns: 0, connect: 0, tls: 0, wait: 0, download: 0, total: 0 },
    cookies: [],
    redirects: [],
    ...overrides,
  }
}

test('compareResponses flags a different status and body as not identical', () => {
  const a = response({ status: 200, bodyText: '{"ok":true}' })
  const b = response({ status: 500, bodyText: '{"error":"boom"}' })
  assert.equal(compareResponses(a, b).identical, false)
})

test('compareResponses reports identical status/headers/body as identical', () => {
  const a = response({ status: 200, bodyText: 'x', headers: { a: '1' } })
  const b = response({ status: 200, bodyText: 'x', headers: { a: '1' } })
  assert.equal(compareResponses(a, b).identical, true)
})
