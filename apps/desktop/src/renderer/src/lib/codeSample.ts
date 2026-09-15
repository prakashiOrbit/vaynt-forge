import type { CodeSampleRequest, RequestModel } from '@vayntforge/engine'

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

/** Builds the generic `{method,url,headers,body}` shape `generateCodeSample`
 * needs from a full request draft — merges enabled params into the URL query
 * string the way the real send pipeline would. */
export function buildCodeSampleRequest(draft: RequestModel): CodeSampleRequest {
  let url = draft.url
  const params = draft.params.filter((p) => p.enabled && p.key)
  if (params.length > 0) {
    const qs = params.map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&')
    url += (url.includes('?') ? '&' : '?') + qs
  }
  const headers = draft.headers.filter((h) => h.enabled && h.key).map((h) => ({ key: h.key, value: h.value }))
  let body: string | undefined
  if (draft.body.type === 'raw' && draft.body.content) {
    body = draft.body.content
  } else if (draft.body.type === 'graphql') {
    body = JSON.stringify({ query: draft.body.query, variables: safeJsonParse(draft.body.variables || '{}') })
  }
  return { method: draft.method, url, headers, body }
}
