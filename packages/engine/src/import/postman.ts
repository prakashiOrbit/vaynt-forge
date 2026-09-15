import type { AuthConfig, HttpMethod, KeyValuePair, RequestBody } from '../types/request'
import type { CollectionPlan, PlannedRequest } from '../openapi/generate'

/**
 * Sprint 12 — Postman Collection v2.x importer. Produces the same
 * `CollectionPlan` shape `planCollectionFromSpec` does, so the renderer's
 * "create collection from plan" code (folders → requests → saveRequest) is
 * shared between OpenAPI and Postman import instead of duplicated.
 */

interface PostmanUrlObject {
  raw?: string
  protocol?: string
  host?: string[] | string
  path?: string[] | string
  query?: { key: string; value?: string; disabled?: boolean }[]
}

interface PostmanHeader {
  key: string
  value: string
  disabled?: boolean
}

interface PostmanBody {
  mode?: 'raw' | 'urlencoded' | 'formdata' | 'file' | 'graphql'
  raw?: string
  options?: { raw?: { language?: string } }
  urlencoded?: { key: string; value: string; disabled?: boolean }[]
  formdata?: { key: string; value: string; disabled?: boolean; type?: string }[]
  graphql?: { query?: string; variables?: string }
}

interface PostmanAuth {
  type?: string
  bearer?: { key: string; value: string }[]
  basic?: { key: string; value: string }[]
  apikey?: { key: string; value: string }[]
}

interface PostmanRequest {
  method?: string
  url?: string | PostmanUrlObject
  header?: PostmanHeader[]
  body?: PostmanBody
  auth?: PostmanAuth
}

interface PostmanItem {
  name?: string
  item?: PostmanItem[]
  request?: PostmanRequest
  variable?: { key: string; value: string }[]
}

interface PostmanCollectionDoc {
  info?: { name?: string; description?: string }
  item?: PostmanItem[]
  variable?: { key: string; value: string }[]
}

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

function toMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? 'GET').toUpperCase()
  return (HTTP_METHODS.has(upper as HttpMethod) ? upper : 'GET') as HttpMethod
}

function urlToString(url: string | PostmanUrlObject | undefined): string {
  if (!url) return ''
  if (typeof url === 'string') return url
  if (url.raw) return url.raw
  const host = Array.isArray(url.host) ? url.host.join('.') : (url.host ?? '')
  const path = Array.isArray(url.path) ? url.path.join('/') : (url.path ?? '')
  const protocol = url.protocol ? `${url.protocol}://` : ''
  return `${protocol}${host}${path ? `/${path}` : ''}`
}

function toHeaders(headers: PostmanHeader[] | undefined): KeyValuePair[] {
  return (headers ?? []).map((h) => ({
    id: crypto.randomUUID(),
    key: h.key,
    value: h.value ?? '',
    enabled: !h.disabled,
  }))
}

function toAuth(auth: PostmanAuth | undefined): AuthConfig {
  if (!auth?.type || auth.type === 'noauth') return { type: 'none' }
  const find = (list: { key: string; value: string }[] | undefined, key: string) =>
    list?.find((kv) => kv.key === key)?.value ?? ''
  switch (auth.type) {
    case 'bearer':
      return { type: 'bearer', token: find(auth.bearer, 'token') }
    case 'basic':
      return { type: 'basic', username: find(auth.basic, 'username'), password: find(auth.basic, 'password') }
    case 'apikey':
      return {
        type: 'apiKey',
        key: find(auth.apikey, 'key'),
        value: find(auth.apikey, 'value'),
        location: find(auth.apikey, 'in') === 'query' ? 'query' : 'header',
      }
    default:
      return { type: 'none' }
  }
}

function toBody(body: PostmanBody | undefined): RequestBody {
  if (!body || !body.mode || body.mode === 'file') return { type: 'none' }
  switch (body.mode) {
    case 'raw': {
      const lang = body.options?.raw?.language
      const language = lang === 'xml' ? 'xml' : lang === 'html' ? 'html' : lang === 'javascript' ? 'javascript' : 'json'
      return { type: 'raw', language, content: body.raw ?? '' }
    }
    case 'urlencoded':
      return {
        type: 'x-www-form-urlencoded',
        pairs: (body.urlencoded ?? []).map((p) => ({ id: crypto.randomUUID(), key: p.key, value: p.value, enabled: !p.disabled })),
      }
    case 'formdata':
      return {
        type: 'form-data',
        pairs: (body.formdata ?? [])
          .filter((p) => p.type !== 'file')
          .map((p) => ({ id: crypto.randomUUID(), key: p.key, value: p.value, enabled: !p.disabled })),
      }
    case 'graphql':
      return { type: 'graphql', query: body.graphql?.query ?? '', variables: body.graphql?.variables ?? '' }
    default:
      return { type: 'none' }
  }
}

function requestFromItem(item: PostmanItem): PlannedRequest {
  const req = item.request ?? {}
  return {
    name: item.name ?? 'Imported request',
    method: toMethod(req.method),
    url: urlToString(req.url),
    params: typeof req.url === 'object' ? (req.url.query ?? []).map((q) => ({ id: crypto.randomUUID(), key: q.key, value: q.value ?? '', enabled: !q.disabled })) : [],
    headers: toHeaders(req.header),
    auth: toAuth(req.auth),
    body: toBody(req.body),
    assertions: [],
    variables: (item.variable ?? []).map((v) => ({ id: crypto.randomUUID(), key: v.key, value: v.value, enabled: true })),
  }
}

function walkItems(items: PostmanItem[], tagPrefix: string, out: Map<string, PlannedRequest[]>): void {
  for (const item of items) {
    if (Array.isArray(item.item)) {
      const prefix = tagPrefix ? `${tagPrefix} / ${item.name ?? 'Folder'}` : (item.name ?? 'Folder')
      walkItems(item.item, prefix, out)
    } else if (item.request) {
      const tag = tagPrefix || 'General'
      const list = out.get(tag) ?? []
      list.push(requestFromItem(item))
      out.set(tag, list)
    }
  }
}

/** Parses a Postman Collection v2.x export into the same `CollectionPlan`
 * shape OpenAPI import produces — nested folders flatten to `"Parent / Child"` tags. */
export function parsePostmanCollection(raw: unknown): CollectionPlan {
  const doc = raw as PostmanCollectionDoc
  if (!doc || typeof doc !== 'object' || !doc.info || !Array.isArray(doc.item)) {
    throw new Error('Not a valid Postman collection (expected an "info" object and an "item" array)')
  }
  const groups = new Map<string, PlannedRequest[]>()
  walkItems(doc.item, '', groups)
  return {
    name: doc.info.name ?? 'Imported Collection',
    description: doc.info.description,
    groups: [...groups.entries()].map(([tag, requests]) => ({ tag, requests })),
  }
}
