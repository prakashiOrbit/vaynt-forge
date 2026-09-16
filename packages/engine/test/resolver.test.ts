import { test } from 'node:test'
import assert from 'node:assert/strict'
import { collectVariables, resolveVariables } from '../src/variables/resolver.ts'

test('resolves a variable from a single scope', () => {
  const ctx = collectVariables({ global: [{ key: 'api_url', value: 'https://api.example.com' }] })
  assert.equal(resolveVariables('{{api_url}}/users', ctx).value, 'https://api.example.com/users')
})

test('an unresolved key is left untouched and reported as missing', () => {
  const ctx = collectVariables({})
  const result = resolveVariables('{{nope}}', ctx)
  assert.equal(result.value, '{{nope}}')
  assert.deepEqual([...result.missingKeys], ['nope'])
})

test('full priority order: temporary > request > collection > environment > global', () => {
  const full = collectVariables({
    global: [{ key: 'k', value: 'global' }],
    environment: [{ key: 'k', value: 'environment' }],
    collection: [{ key: 'k', value: 'collection' }],
    request: [{ key: 'k', value: 'request' }],
    temporary: [{ key: 'k', value: 'temporary' }],
  })
  assert.equal(resolveVariables('{{k}}', full).value, 'temporary')

  const noTemporary = collectVariables({
    global: [{ key: 'k', value: 'global' }],
    environment: [{ key: 'k', value: 'environment' }],
    collection: [{ key: 'k', value: 'collection' }],
    request: [{ key: 'k', value: 'request' }],
  })
  assert.equal(resolveVariables('{{k}}', noTemporary).value, 'request')

  const collectionAndBelow = collectVariables({
    global: [{ key: 'k', value: 'global' }],
    environment: [{ key: 'k', value: 'environment' }],
    collection: [{ key: 'k', value: 'collection' }],
  })
  assert.equal(resolveVariables('{{k}}', collectionAndBelow).value, 'collection')

  const environmentAndGlobal = collectVariables({
    global: [{ key: 'k', value: 'global' }],
    environment: [{ key: 'k', value: 'environment' }],
  })
  assert.equal(resolveVariables('{{k}}', environmentAndGlobal).value, 'environment')

  const globalOnly = collectVariables({ global: [{ key: 'k', value: 'global' }] })
  assert.equal(resolveVariables('{{k}}', globalOnly).value, 'global')
})

test('a temporary-scoped variable resolves even when nothing else defines that key', () => {
  const ctx = collectVariables({ temporary: [{ key: 'sessionToken', value: 'abc123' }] })
  assert.equal(resolveVariables('Bearer {{sessionToken}}', ctx).value, 'Bearer abc123')
})
