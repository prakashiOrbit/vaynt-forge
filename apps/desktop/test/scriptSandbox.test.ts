import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runScript } from '../src/main/scriptSandbox.ts'
import type { ScriptContext } from '@vayntforge/engine'

function baseContext(overrides: Partial<ScriptContext> = {}): ScriptContext {
  return {
    request: { method: 'GET', url: 'https://api.acme.dev/v1/users', headers: {} },
    environment: { api_url: 'https://api.acme.dev' },
    ...overrides,
  }
}

test('runs a simple script and captures console.log', () => {
  const result = runScript('console.log("hello", 42)', baseContext())
  assert.equal(result.error, undefined)
  assert.deepEqual(result.logs, ['hello 42'])
})

test('pm.environment.set is captured as a patch, not applied globally', () => {
  const result = runScript("pm.environment.set('token', 'abc123')", baseContext())
  assert.equal(result.error, undefined)
  assert.deepEqual(result.environmentPatch, { token: 'abc123' })
})

test('pm.environment.get reads the existing snapshot', () => {
  const result = runScript("console.log(pm.environment.get('api_url'))", baseContext())
  assert.deepEqual(result.logs, ['https://api.acme.dev'])
})

test('pm.response.json() parses the response body for post-response scripts', () => {
  const ctx = baseContext({
    response: {
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { token: 'xyz' },
      bodyText: '{"token":"xyz"}',
      timeMs: 42,
    },
  })
  const result = runScript("pm.environment.set('token', pm.response.json().token)", ctx)
  assert.deepEqual(result.environmentPatch, { token: 'xyz' })
})

test('blocks require — no such global exists in the sandbox', () => {
  const result = runScript("require('node:fs')", baseContext())
  assert.ok(result.error)
  assert.match(result.error!, /require is not defined/)
})

test('blocks process — no such global exists in the sandbox', () => {
  const result = runScript('process.exit(1)', baseContext())
  assert.ok(result.error)
  assert.match(result.error!, /process is not defined/)
})

test('blocks network access — no fetch/XHR global exists in the sandbox', () => {
  const result = runScript("fetch('https://example.com')", baseContext())
  assert.ok(result.error)
  assert.match(result.error!, /fetch is not defined/)
})

test('a runaway loop is terminated by the timeout, not left to hang', () => {
  const start = Date.now()
  const result = runScript('while (true) {}', baseContext())
  const elapsed = Date.now() - start
  assert.equal(result.timedOut, true)
  assert.ok(elapsed < 5000, `expected the timeout to cut the loop short, took ${elapsed}ms`)
})

test('a thrown error inside the script is reported, not left unhandled', () => {
  const result = runScript("throw new Error('boom')", baseContext())
  assert.match(result.error!, /boom/)
})
