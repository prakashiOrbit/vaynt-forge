import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockRequestClient, createDraftRequest, collectVariables } from '../src/index.ts'

const ctx = { variables: collectVariables({}) }

test('returns a 200 for an ordinary request', async () => {
  const req = createDraftRequest({ id: 'r1', workspaceId: 'w1', url: 'https://api.acme.dev/v1/users', method: 'GET' })
  const res = await new MockRequestClient().execute(req, ctx)
  assert.equal(res.status, 200)
  assert.equal(res.timeMs, 124)
})

test('simulates a 500 for POST .../orders', async () => {
  const req = createDraftRequest({ id: 'r2', workspaceId: 'w1', url: 'https://api.acme.dev/v1/orders', method: 'POST' })
  const res = await new MockRequestClient().execute(req, ctx)
  assert.equal(res.status, 500)
  assert.equal(res.timeMs, 923)
})

test('simulates a redirect chain for GET .../redirect', async () => {
  const req = createDraftRequest({
    id: 'r3',
    workspaceId: 'w1',
    url: 'https://api.acme.dev/v1/redirect',
    method: 'GET',
  })
  const res = await new MockRequestClient().execute(req, ctx)
  assert.equal(res.status, 200)
  assert.equal(res.redirects.length, 2)
  assert.equal(res.redirects[0]?.status, 302)
})

test('resolves {{variables}} in the URL before pattern-matching', async () => {
  const req = createDraftRequest({
    id: 'r4',
    workspaceId: 'w1',
    url: 'https://{{host}}/v1/orders',
    method: 'POST',
  })
  const withHost = { variables: collectVariables({ global: [{ key: 'host', value: 'api.acme.dev' }] }) }
  const res = await new MockRequestClient().execute(req, withHost)
  assert.equal(res.status, 500)
})

test('an unresolvable URL is a client error, not a throw', async () => {
  const req = createDraftRequest({ id: 'r5', workspaceId: 'w1', url: 'not a url', method: 'GET' })
  const res = await new MockRequestClient().execute(req, ctx)
  assert.equal(res.status, 0)
  assert.ok(res.error)
})
