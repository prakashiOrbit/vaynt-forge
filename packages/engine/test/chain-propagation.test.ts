import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MockRequestClient, collectVariables, resolveRequest, resolvePath, createDraftRequest } from '../src/index.ts'
import type { KeyValuePair } from '../src/index.ts'

/**
 * Proves the exact mechanism the Collection Runner (Sprint 7) relies on for
 * request chaining: extract a value from one response with a JSONPath, feed
 * it into a later request's variable resolution, and confirm the later
 * request's *resolved* URL actually contains the extracted value — not the
 * `{{...}}` placeholder. This is the real propagation path (sequential
 * `sendRequest` calls threading `extraVariables` forward), verified without
 * needing the desktop app's IPC-bound script bridge, which this path doesn't
 * touch at all.
 */
test('a value extracted from one response resolves into a later request', async () => {
  const client = new MockRequestClient()

  // Step 1: run the "extraction" request and pull a value out of its response.
  const first = createDraftRequest({
    id: 'chain_1',
    workspaceId: 'w1',
    method: 'GET',
    url: 'https://api.acme.dev/v1/users',
  })
  const firstResponse = await client.execute(first, { variables: collectVariables({}) })
  const extractedId = resolvePath(firstResponse.body, '$.data[0].id')
  assert.equal(extractedId, 'usr_1024', 'sanity check on the mock fixture the extraction relies on')

  // Step 2: exactly what CollectionRunner does — push the extraction into
  // `extraVariables` and resolve a later request's URL with it at request scope.
  const extraVariables: KeyValuePair[] = [
    { id: 'x1', key: 'extractedUserId', value: String(extractedId), enabled: true },
  ]
  const second = createDraftRequest({
    id: 'chain_2',
    workspaceId: 'w1',
    method: 'GET',
    url: 'https://api.acme.dev/v1/users/{{extractedUserId}}',
  })
  second.variables = [...second.variables, ...extraVariables]
  const ctx = { variables: collectVariables({ request: second.variables }) }
  const resolved = resolveRequest(second, ctx.variables)

  assert.equal(resolved.url, 'https://api.acme.dev/v1/users/usr_1024')
  assert.ok(!resolved.url.includes('{{'), 'the placeholder must actually be substituted, not left raw')
})

test('an unmatched jsonPath extracts nothing, and the placeholder is left unresolved rather than silently wrong', async () => {
  const client = new MockRequestClient()
  const first = createDraftRequest({ id: 'chain_3', workspaceId: 'w1', method: 'GET', url: 'https://api.acme.dev/v1/users' })
  const response = await client.execute(first, { variables: collectVariables({}) })
  const missing = resolvePath(response.body, '$.nope.notThere')
  assert.equal(missing, undefined)

  const second = createDraftRequest({ id: 'chain_4', workspaceId: 'w1', method: 'GET', url: 'https://api.acme.dev/v1/x/{{neverSet}}' })
  const resolved = resolveRequest(second, collectVariables({}))
  // `new URL(...)` percent-encodes the literal braces (`{`/`}` aren't valid
  // unencoded URL characters) — decode before asserting the placeholder
  // itself was left untouched rather than silently substituted with garbage.
  assert.equal(decodeURIComponent(resolved.url), 'https://api.acme.dev/v1/x/{{neverSet}}')
})
