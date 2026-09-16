import { test } from 'node:test'
import assert from 'node:assert/strict'

/**
 * Same regression guard as `@vayntforge/engine`'s `dist-resolution.test.ts`
 * — every other test in this package imports `../src/index` by relative
 * path, which never exercises whether the *published* package (resolved by
 * name, through `dist`) actually works via plain Node ESM. `pretest`
 * rebuilds `dist` first, so this checks real, current output.
 */
test('the package resolves via plain Node ESM by its published name, not just by relative path', async () => {
  const mod = await import('@vayntforge/sqlite')
  assert.equal(typeof mod.SQLiteStorage, 'function')
})
