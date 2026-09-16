import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderVisualizerHtml } from '../src/scripting/visualizer.ts'

test('renders {{path}} interpolation against real data, including nested dot-paths', () => {
  const html = renderVisualizerHtml('<h1>{{user.name}}</h1>', { user: { name: 'Ada' } })
  assert.equal(html, '<h1>Ada</h1>')
})

test('supports #each and #if block helpers', () => {
  const html = renderVisualizerHtml(
    '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>{{#if flag}}<p>on</p>{{/if}}',
    { items: ['a', 'b', 'c'], flag: true }
  )
  assert.equal(html, '<ul><li>a</li><li>b</li><li>c</li></ul><p>on</p>')
})

test('#if falls through to #else when the condition is falsy', () => {
  const html = renderVisualizerHtml('{{#if ok}}yes{{else}}no{{/if}}', { ok: false })
  assert.equal(html, 'no')
})

test('#unless renders its body only when the condition is falsy', () => {
  const html = renderVisualizerHtml('{{#unless done}}pending{{/unless}}', { done: false })
  assert.equal(html, 'pending')
  assert.equal(renderVisualizerHtml('{{#unless done}}pending{{/unless}}', { done: true }), '')
})

test('#each exposes @index for arrays and @key for objects', () => {
  const arrayHtml = renderVisualizerHtml('{{#each items}}{{@index}}:{{this}} {{/each}}', { items: ['x', 'y'] })
  assert.equal(arrayHtml, '0:x 1:y ')

  const objectHtml = renderVisualizerHtml('{{#each obj}}{{@key}}={{this}} {{/each}}', { obj: { a: 1, b: 2 } })
  assert.equal(objectHtml, 'a=1 b=2 ')
})

test('escapes interpolated values by default, but {{{triple}}} renders raw HTML', () => {
  const escaped = renderVisualizerHtml('<p>{{value}}</p>', { value: '<b>hi</b>' })
  assert.equal(escaped, '<p>&lt;b&gt;hi&lt;/b&gt;</p>')

  const raw = renderVisualizerHtml('<p>{{{value}}}</p>', { value: '<b>hi</b>' })
  assert.equal(raw, '<p><b>hi</b></p>')
})

test('an unclosed block renders a readable error instead of throwing', () => {
  const html = renderVisualizerHtml('{{#each items}}unclosed', { items: [] })
  assert.match(html, /Visualizer template error/)
  assert.match(html, /Unclosed \{\{#each\}\} block/)
})

test('missing data falls back to an empty object rather than crashing', () => {
  const html = renderVisualizerHtml('<p>{{missing}}</p>', undefined)
  assert.equal(html, '<p></p>')
})
