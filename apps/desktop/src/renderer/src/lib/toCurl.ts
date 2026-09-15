import type { RequestModel } from '@vayntforge/engine'

/** Produces a valid, copy-pasteable cURL command for a request. Shared by the
 * request builder's More menu and the Collections tree's context menu. */
export function toCurl(r: RequestModel): string {
  const parts = [`curl -X ${r.method} '${r.url}'`]
  for (const h of r.headers) {
    if (h.enabled && h.key) parts.push(`-H '${h.key}: ${h.value}'`)
  }
  if (r.body.type === 'raw' && r.body.content) {
    parts.push(`--data '${r.body.content.replace(/'/g, "'\\''")}'`)
  } else if (r.body.type === 'graphql') {
    parts.push(`--data '${JSON.stringify({ query: r.body.query, variables: r.body.variables })}'`)
  }
  return parts.join(' \\\n  ')
}
