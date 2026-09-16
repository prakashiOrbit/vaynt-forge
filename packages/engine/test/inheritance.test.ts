import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveAncestorChain,
  resolveAncestorScripts,
  resolveCollectionVariables,
  resolveEffectiveAuth,
} from '../src/collections/inheritance.ts'
import type { Collection, Folder } from '../src/index.ts'

function collection(overrides: Partial<Collection> = {}): Collection {
  return { id: 'col_1', name: 'API', workspaceId: 'w1', createdAt: 0, updatedAt: 0, ...overrides }
}

function folder(overrides: Partial<Folder> = {}): Folder {
  return { id: 'fld_1', collectionId: 'col_1', name: 'Folder', requestIds: [], ...overrides }
}

test('resolveAncestorChain walks folderId up through parentFolderId to the collection, outermost first', () => {
  const outer = folder({ id: 'fld_outer', name: 'Outer' })
  const inner = folder({ id: 'fld_inner', name: 'Inner', parentFolderId: 'fld_outer' })
  const chain = resolveAncestorChain(
    { collectionId: 'col_1', folderId: 'fld_inner' },
    [collection()],
    { col_1: [outer, inner] }
  )
  assert.equal(chain.collection?.id, 'col_1')
  assert.deepEqual(chain.folders.map((f) => f.id), ['fld_outer', 'fld_inner'])
})

test('resolveAncestorChain returns an empty chain for a request with no collectionId', () => {
  const chain = resolveAncestorChain({}, [collection()], {})
  assert.equal(chain.collection, undefined)
  assert.deepEqual(chain.folders, [])
})

test('resolveAncestorChain stops cleanly on a dangling folderId instead of throwing', () => {
  const chain = resolveAncestorChain({ collectionId: 'col_1', folderId: 'nope' }, [collection()], { col_1: [] })
  assert.deepEqual(chain.folders, [])
})

test('resolveEffectiveAuth returns a concrete auth unchanged', () => {
  const auth = { type: 'bearer' as const, token: 'tok' }
  assert.deepEqual(resolveEffectiveAuth(auth, { folders: [] }), auth)
})

test('resolveEffectiveAuth falls back to none with nothing to inherit', () => {
  assert.deepEqual(resolveEffectiveAuth({ type: 'inherit' }, { folders: [] }), { type: 'none' })
})

test('resolveEffectiveAuth prefers the nearest folder over the collection', () => {
  const chain = {
    collection: collection({ auth: { type: 'basic', username: 'col', password: 'x' } }),
    folders: [
      folder({ id: 'outer', auth: { type: 'inherit' } }),
      folder({ id: 'inner', auth: { type: 'bearer', token: 'inner-tok' } }),
    ],
  }
  assert.deepEqual(resolveEffectiveAuth({ type: 'inherit' }, chain), { type: 'bearer', token: 'inner-tok' })
})

test('resolveEffectiveAuth skips a folder set to inherit and keeps walking outward to the collection', () => {
  const chain = {
    collection: collection({ auth: { type: 'apiKey', location: 'header' as const, key: 'X-Key', value: 'v' } }),
    folders: [folder({ id: 'inner', auth: { type: 'inherit' } })],
  }
  assert.deepEqual(resolveEffectiveAuth({ type: 'inherit' }, chain), {
    type: 'apiKey',
    location: 'header',
    key: 'X-Key',
    value: 'v',
  })
})

test('resolveCollectionVariables maps Variable[] to plain key/value pairs', () => {
  const chain = {
    collection: collection({
      variables: [
        { id: 'v1', key: 'baseUrl', initialValue: 'https://api.dev', currentValue: 'https://api.dev', scope: 'collection' as const, secret: false },
      ],
    }),
    folders: [],
  }
  assert.deepEqual(resolveCollectionVariables(chain), [{ key: 'baseUrl', value: 'https://api.dev' }])
})

test('resolveCollectionVariables returns an empty array with no collection', () => {
  assert.deepEqual(resolveCollectionVariables({ folders: [] }), [])
})

test('resolveAncestorScripts orders collection first, then folders outermost to innermost, skipping blank scripts', () => {
  const chain = {
    collection: collection({ scripts: { preRequest: 'console.log("col-pre")', postResponse: '' } }),
    folders: [
      folder({ id: 'outer', scripts: { preRequest: 'console.log("outer-pre")', postResponse: 'console.log("outer-post")' } }),
      folder({ id: 'inner', scripts: { preRequest: '  ', postResponse: 'console.log("inner-post")' } }),
    ],
  }
  const result = resolveAncestorScripts(chain)
  assert.deepEqual(result.preRequest, ['console.log("col-pre")', 'console.log("outer-pre")'])
  assert.deepEqual(result.postResponse, ['console.log("outer-post")', 'console.log("inner-post")'])
})
