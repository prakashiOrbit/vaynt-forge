/**
 * A small, hand-rolled Mustache/Handlebars-style template engine for the
 * Response panel's Visualizer (`pm.visualizer.set(template, data)`).
 *
 * The real `handlebars` package was tried first, but its `compile()`
 * JIT-compiles templates via `new Function(...)` — blocked by this app's own
 * CSP (`script-src 'self'`, no `unsafe-eval`), confirmed by actually sending
 * a request with a visualizer script and seeing the CSP violation land in
 * the panel. Loosening `script-src` app-wide to fix that would be a second,
 * broader security tradeoff beyond the "no live `<script>` in templates"
 * decision already made for this feature, so this interpreter walks a
 * parsed template tree at render time instead of generating and executing
 * code — no `eval`/`Function` anywhere, and no CSP changes needed beyond
 * letting the iframe itself load.
 *
 * Supported subset: `{{path}}` (HTML-escaped), `{{{path}}}` (raw),
 * `{{#each path}}...{{/each}}` (with `this`/`@index`/`@key`),
 * `{{#if path}}...{{else}}...{{/if}}`, `{{#unless path}}...{{/unless}}`,
 * dot-path property/array-index access. Not supported: custom helpers,
 * partials, `{{#with}}`, `../` parent-scope references.
 */

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'var'; path: string; raw: boolean }
  | { kind: 'each'; path: string; body: Node[] }
  | { kind: 'if'; path: string; negate: boolean; body: Node[]; elseBody: Node[] }

interface Tag {
  raw: boolean
  /** e.g. `each items`, `/each`, `if x`, `else`, `name` */
  content: string
  start: number
  end: number
}

function tokenizeTags(template: string): Tag[] {
  const tags: Tag[] = []
  const re = /\{\{(\{)?\s*([\s\S]*?)\s*(\})?\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(template))) {
    const tripleOpen = m[1] === '{'
    const tripleClose = m[3] === '}'
    tags.push({ raw: tripleOpen && tripleClose, content: m[2] ?? '', start: m.index, end: m.index + m[0].length })
  }
  return tags
}

function parse(template: string): Node[] {
  const tags = tokenizeTags(template)
  let cursor = 0
  let tagIndex = 0

  function parseUntil(closers: string[], blockName?: string): { nodes: Node[]; closedBy: string } {
    const nodes: Node[] = []
    while (tagIndex < tags.length) {
      const tag = tags[tagIndex]
      if (!tag) break
      if (tag.start > cursor) nodes.push({ kind: 'text', text: template.slice(cursor, tag.start) })

      const content = tag.content.trim()
      if (closers.includes(content)) {
        cursor = tag.end
        tagIndex += 1
        return { nodes, closedBy: content }
      }

      tagIndex += 1
      cursor = tag.end

      if (content.startsWith('#each ')) {
        const path = content.slice('#each '.length).trim()
        const inner = parseUntil(['/each'], '{{#each}}')
        nodes.push({ kind: 'each', path, body: inner.nodes })
      } else if (content.startsWith('#if ')) {
        const path = content.slice('#if '.length).trim()
        const thenPart = parseUntil(['else', '/if'], '{{#if}}')
        const elseBody = thenPart.closedBy === 'else' ? parseUntil(['/if'], '{{#if}}').nodes : []
        nodes.push({ kind: 'if', path, negate: false, body: thenPart.nodes, elseBody })
      } else if (content.startsWith('#unless ')) {
        const path = content.slice('#unless '.length).trim()
        const thenPart = parseUntil(['else', '/unless'], '{{#unless}}')
        const elseBody = thenPart.closedBy === 'else' ? parseUntil(['/unless'], '{{#unless}}').nodes : []
        nodes.push({ kind: 'if', path, negate: true, body: thenPart.nodes, elseBody })
      } else if (content.startsWith('!')) {
        // comment — skip
      } else {
        nodes.push({ kind: 'var', path: content, raw: tag.raw })
      }
    }
    if (blockName) throw new Error(`Unclosed ${blockName} block`)
    if (cursor < template.length) nodes.push({ kind: 'text', text: template.slice(cursor) })
    return { nodes, closedBy: '' }
  }

  return parseUntil([]).nodes
}

interface Scope {
  value: unknown
  index?: number
  key?: string
  parent?: Scope
}

function resolvePath(scope: Scope, path: string): unknown {
  if (path === 'this' || path === '.') return scope.value
  if (path === '@index') return scope.index
  if (path === '@key') return scope.key

  let current: unknown = scope.value
  for (const segment of path.split('.')) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0
  return Boolean(value)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stringifyValue(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function renderNodes(nodes: Node[], scope: Scope): string {
  let out = ''
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
        out += node.text
        break
      case 'var': {
        const value = resolvePath(scope, node.path)
        const text = stringifyValue(value)
        out += node.raw ? text : escapeHtml(text)
        break
      }
      case 'if': {
        const truthy = isTruthy(resolvePath(scope, node.path))
        out += renderNodes((truthy && !node.negate) || (!truthy && node.negate) ? node.body : node.elseBody, scope)
        break
      }
      case 'each': {
        const list = resolvePath(scope, node.path)
        if (Array.isArray(list)) {
          list.forEach((item, index) => {
            out += renderNodes(node.body, { value: item, index, parent: scope })
          })
        } else if (list && typeof list === 'object') {
          for (const [key, value] of Object.entries(list)) {
            out += renderNodes(node.body, { value, key, parent: scope })
          }
        }
        break
      }
    }
  }
  return out
}

/**
 * Renders a `pm.visualizer.set(template, data)` call into a static HTML
 * string. A template parse/render error surfaces as a readable HTML block
 * instead of throwing, since this runs against whatever a script produced,
 * not something the Response panel should crash over.
 */
export function renderVisualizerHtml(template: string, data: unknown): string {
  try {
    const nodes = parse(template)
    return renderNodes(nodes, { value: data ?? {} })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return `<pre style="color:#e5484d;white-space:pre-wrap;font-family:monospace;">Visualizer template error:\n${escapeHtml(message)}</pre>`
  }
}
