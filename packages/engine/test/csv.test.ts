import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseCsv } from '../src/io/csv.ts'

test('parses a simple header + rows CSV into objects', () => {
  const csv = 'name,id\nAlice,1\nBob,2\n'
  assert.deepEqual(parseCsv(csv), [
    { name: 'Alice', id: '1' },
    { name: 'Bob', id: '2' },
  ])
})

test('handles quoted fields with embedded commas and escaped quotes', () => {
  const csv = 'name,note\n"Smith, John","He said ""hi"""\n'
  assert.deepEqual(parseCsv(csv), [{ name: 'Smith, John', note: 'He said "hi"' }])
})

test('handles quoted fields with embedded newlines', () => {
  const csv = 'name,bio\n"Ann","Line1\nLine2"\n'
  assert.deepEqual(parseCsv(csv), [{ name: 'Ann', bio: 'Line1\nLine2' }])
})

test('handles CRLF line endings', () => {
  const csv = 'a,b\r\n1,2\r\n3,4\r\n'
  assert.deepEqual(parseCsv(csv), [
    { a: '1', b: '2' },
    { a: '3', b: '4' },
  ])
})

test('returns an empty array for header-only or empty input', () => {
  assert.deepEqual(parseCsv('a,b\n'), [])
  assert.deepEqual(parseCsv(''), [])
})

test('ignores a trailing blank line', () => {
  const csv = 'a,b\n1,2\n\n'
  assert.deepEqual(parseCsv(csv), [{ a: '1', b: '2' }])
})

test('trims header names but preserves data-cell whitespace', () => {
  const csv = ' name , id \nAlice , 1\n'
  assert.deepEqual(parseCsv(csv), [{ name: 'Alice ', id: ' 1' }])
})
