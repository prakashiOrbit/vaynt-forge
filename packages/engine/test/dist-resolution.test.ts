import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * A real regression guard, not a style preference: `moduleResolution:
 * "bundler"` (this package's tsconfig) type-checks extensionless relative
 * imports fine, but plain Node's real ESM resolver requires an explicit
 * `.js` (and an explicit `/index.js` for a directory) — so a contributor
 * adding a new relative import without one would pass `npm run typecheck`
 * and every other test here (which import via relative path straight into
 * `src`, never touching `dist`) while silently breaking this package for
 * anyone who resolves it by package name through plain Node, e.g.
 * `apps/cli` if it ever stops aliasing straight to `src`. `pretest` in
 * package.json rebuilds `dist` before this runs, so it's checking the real,
 * current output — not a stale artifact from whenever `build` last ran by
 * hand.
 */
test('the package resolves via plain Node ESM by its published name, not just by relative path', async () => {
  const mod = await import('@vayntforge/engine')
  assert.ok(Object.keys(mod).length > 50, 'expected the full barrel export surface')
  assert.equal(typeof mod.collectVariables, 'function')
  assert.equal(typeof mod.resolveVariables, 'function')
})

test('every Node-only subpath export also resolves via plain Node ESM', async () => {
  const httpClient = await import('@vayntforge/engine/networking/http-client')
  assert.equal(typeof httpClient.UndiciRequestClient, 'function')

  const oauth2 = await import('@vayntforge/engine/networking/oauth2-client')
  assert.equal(typeof oauth2.fetchClientCredentialsToken, 'function')

  const sandbox = await import('@vayntforge/engine/scripting/sandbox')
  assert.equal(typeof sandbox.runScript, 'function')

  const runner = await import('@vayntforge/engine/runner/collection-runner')
  assert.equal(typeof runner.runCollection, 'function')
  assert.equal(typeof runner.sendResolvedRequest, 'function')
})
