import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseDotEnv } from '../src/index.ts'

test('parses basic KEY=VALUE lines', () => {
  const entries = parseDotEnv('API_URL=https://api.acme.dev\nTOKEN=abc123')
  assert.deepEqual(entries, [
    { key: 'API_URL', value: 'https://api.acme.dev' },
    { key: 'TOKEN', value: 'abc123' },
  ])
})

test('skips comments and blank lines', () => {
  const entries = parseDotEnv('# a comment\n\nKEY=value\n  # indented comment\n')
  assert.deepEqual(entries, [{ key: 'KEY', value: 'value' }])
})

test('strips a leading "export "', () => {
  const entries = parseDotEnv('export KEY=value')
  assert.deepEqual(entries, [{ key: 'KEY', value: 'value' }])
})

test('unquotes double- and single-quoted values', () => {
  const entries = parseDotEnv('A="hello world"\nB=\'single quoted\'\nC=bare')
  assert.deepEqual(entries, [
    { key: 'A', value: 'hello world' },
    { key: 'B', value: 'single quoted' },
    { key: 'C', value: 'bare' },
  ])
})

test('unescapes \\n inside double-quoted values only', () => {
  const entries = parseDotEnv('A="line1\\nline2"\nB=\'no\\nescape\'')
  assert.equal(entries[0]?.value, 'line1\nline2')
  assert.equal(entries[1]?.value, 'no\\nescape')
})

test('ignores lines with no "="', () => {
  const entries = parseDotEnv('not a valid line\nKEY=value')
  assert.deepEqual(entries, [{ key: 'KEY', value: 'value' }])
})

test('returns an empty list for empty input', () => {
  assert.deepEqual(parseDotEnv(''), [])
})
