import type { RequestModel, KeyValuePair } from '../types/request.js'
import type { ResolutionContext } from '../types/variables.js'
import { resolveVariables } from '../variables/resolver.js'
import { applyAuth } from './auth.js'

export interface ResolvedRequest {
  url: string
  method: string
  headers: Record<string, string>
  /**
   * String body, ready to send. `binary` requests resolve to `undefined`
   * here — reading the file into a Buffer needs `node:fs`, so that happens
   * separately in the (main-process-only) http client, keeping this module
   * usable from the renderer without pulling in Node's `Buffer` type.
   */
  body: string | undefined
}

function resolve(template: string, ctx: ResolutionContext): string {
  return resolveVariables(template, ctx).value
}

function enabledResolved(pairs: KeyValuePair[], ctx: ResolutionContext): KeyValuePair[] {
  return pairs.filter((p) => p.enabled && p.key).map((p) => ({ ...p, value: resolve(p.value, ctx) }))
}

/** Resolves `{{variables}}` across url/params/headers/body and applies auth — shared by every client. */
export function resolveRequest(request: RequestModel, ctx: ResolutionContext): ResolvedRequest {
  const authContrib = applyAuth(request.auth, ctx)

  const params = [...enabledResolved(request.params, ctx), ...authContrib.params]
  const headerPairs = [...enabledResolved(request.headers, ctx), ...authContrib.headers]

  const baseUrl = resolve(request.url, ctx)
  const url = new URL(baseUrl)
  for (const p of params) url.searchParams.append(p.key, p.value)

  const headers: Record<string, string> = {}
  for (const h of headerPairs) headers[h.key] = h.value

  const body = resolveBody(request, ctx)
  if (body !== undefined && !hasHeader(headers, 'content-type')) {
    const contentType = defaultContentType(request)
    if (contentType) headers['Content-Type'] = contentType
  }
  // Real-world APIs commonly reject requests with no User-Agent at all
  // (e.g. GitHub's API returns a 403 "Please make sure your request has a
  // User-Agent header") — found by actually sending a real request, not
  // read from docs. Only filled in when the user hasn't already set one.
  if (!hasHeader(headers, 'user-agent')) {
    headers['User-Agent'] = 'VayntForge/1.0'
  }

  return { url: url.toString(), method: request.method, headers, body }
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return Object.keys(headers).some((k) => k.toLowerCase() === name)
}

function defaultContentType(request: RequestModel): string | undefined {
  switch (request.body.type) {
    case 'x-www-form-urlencoded':
      return 'application/x-www-form-urlencoded'
    case 'graphql':
      return 'application/json'
    case 'binary':
      return 'application/octet-stream'
    case 'raw':
      switch (request.body.language) {
        case 'json':
          return 'application/json'
        case 'xml':
          return 'application/xml'
        case 'html':
          return 'text/html'
        case 'javascript':
          return 'application/javascript'
        default:
          return 'text/plain'
      }
    default:
      return undefined
  }
}

function resolveBody(request: RequestModel, ctx: ResolutionContext): string | undefined {
  const body = request.body
  switch (body.type) {
    case 'none':
      return undefined
    case 'raw':
      return resolve(body.content, ctx)
    case 'x-www-form-urlencoded': {
      const params = new URLSearchParams()
      for (const p of enabledResolved(body.pairs, ctx)) params.append(p.key, p.value)
      return params.toString()
    }
    case 'form-data':
      return buildMultipart(enabledResolved(body.pairs, ctx))
    case 'graphql':
      return JSON.stringify({
        query: resolve(body.query, ctx),
        variables: safeJsonParse(resolve(body.variables || '{}', ctx)),
      })
    case 'binary':
      return undefined // read from disk by the caller (needs fs access)
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return {}
  }
}

const BOUNDARY = 'vayntforge-boundary-7d1f3a'

function buildMultipart(pairs: KeyValuePair[]): string {
  const parts = pairs.map(
    (p) => `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${p.key}"\r\n\r\n${p.value}\r\n`
  )
  return `${parts.join('')}--${BOUNDARY}--\r\n`
}

export const MULTIPART_BOUNDARY = BOUNDARY
