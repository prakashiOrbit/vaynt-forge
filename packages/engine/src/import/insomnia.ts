import type { AuthConfig, HttpMethod, KeyValuePair, RawLanguage, RequestBody } from '../types/request.js'
import type { CollectionPlan, PlannedRequest } from '../openapi/generate.js'

/**
 * Insomnia v4 export importer. Produces the same `CollectionPlan` shape
 * `parsePostmanCollection`/`planCollectionFromSpec` do, so the renderer's
 * "create collection from plan" code is shared across every import source.
 *
 * Insomnia's export is a flat `resources` array (not Postman's nested
 * `item` tree) — hierarchy is reconstructed by walking each request's
 * `parentId` chain up through `request_group` resources, exactly mirroring
 * Postman import's "nested folders flatten to a `Parent / Child` tag"
 * convention rather than building real nested `Folder` records.
 */

interface InsomniaKeyValue {
  name?: string
  value?: string
  disabled?: boolean
}

interface InsomniaBody {
  mimeType?: string
  text?: string
  params?: InsomniaKeyValue[]
}

interface InsomniaAuth {
  type?: string
  disabled?: boolean
  username?: string
  password?: string
  token?: string
  key?: string
  value?: string
  /** Where an API key goes — Insomnia's own export field name for this isn't fully documented; both observed spellings are checked. */
  addTo?: string
  in?: string
}

interface InsomniaResource {
  _id?: string
  _type?: string
  parentId?: string | null
  name?: string
  method?: string
  url?: string
  headers?: InsomniaKeyValue[]
  parameters?: InsomniaKeyValue[]
  body?: InsomniaBody
  authentication?: InsomniaAuth
  description?: string
}

interface InsomniaExportDoc {
  _type?: string
  resources?: InsomniaResource[]
}

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

function toMethod(method: string | undefined): HttpMethod {
  const upper = (method ?? 'GET').toUpperCase()
  return (HTTP_METHODS.has(upper as HttpMethod) ? upper : 'GET') as HttpMethod
}

function toKeyValuePairs(list: InsomniaKeyValue[] | undefined): KeyValuePair[] {
  return (list ?? [])
    .filter((kv): kv is InsomniaKeyValue & { name: string } => Boolean(kv.name))
    .map((kv) => ({ id: crypto.randomUUID(), key: kv.name, value: kv.value ?? '', enabled: !kv.disabled }))
}

function toAuth(auth: InsomniaAuth | undefined): AuthConfig {
  if (!auth?.type || auth.disabled) return { type: 'none' }
  switch (auth.type.toLowerCase()) {
    case 'basic':
      return { type: 'basic', username: auth.username ?? '', password: auth.password ?? '' }
    case 'bearer':
      return { type: 'bearer', token: auth.token ?? '' }
    case 'apikey': {
      const placement = (auth.addTo ?? auth.in ?? 'header').toLowerCase()
      return { type: 'apiKey', key: auth.key ?? '', value: auth.value ?? '', location: placement === 'query' ? 'query' : 'header' }
    }
    default:
      // digest/oauth1/oauth2/ntlm/hawk/asap/aws-iam/netrc — not representable
      // here yet; dropped to `none` rather than faked, same convention
      // parsePostmanCollection already uses for its own unsupported types.
      return { type: 'none' }
  }
}

function rawLanguageFor(mimeType: string): RawLanguage {
  switch (mimeType) {
    case 'application/xml':
      return 'xml'
    case 'text/html':
      return 'html'
    case 'application/javascript':
      return 'javascript'
    case 'application/json':
      return 'json'
    default:
      return 'text'
  }
}

function toBody(body: InsomniaBody | undefined): RequestBody {
  if (!body || !body.mimeType) return body?.text ? { type: 'raw', language: 'text', content: body.text } : { type: 'none' }
  switch (body.mimeType) {
    case 'application/x-www-form-urlencoded':
      return { type: 'x-www-form-urlencoded', pairs: toKeyValuePairs(body.params) }
    case 'multipart/form-data':
      return { type: 'form-data', pairs: toKeyValuePairs(body.params) }
    case 'graphql': {
      try {
        const parsed = JSON.parse(body.text ?? '{}') as { query?: string; variables?: unknown }
        return { type: 'graphql', query: parsed.query ?? '', variables: parsed.variables ? JSON.stringify(parsed.variables) : '' }
      } catch {
        return { type: 'graphql', query: body.text ?? '', variables: '' }
      }
    }
    default:
      return { type: 'raw', language: rawLanguageFor(body.mimeType), content: body.text ?? '' }
  }
}

/** Walks a request's `parentId` chain up through `request_group` resources into a `"Parent / Child"` tag string. */
function folderTagFor(parentId: string | null | undefined, byId: Map<string, InsomniaResource>): string {
  const segments: string[] = []
  let current = parentId ? byId.get(parentId) : undefined
  while (current && current._type === 'request_group') {
    segments.unshift(current.name || 'Folder')
    current = current.parentId ? byId.get(current.parentId) : undefined
  }
  return segments.length > 0 ? segments.join(' / ') : 'General'
}

function requestFromResource(resource: InsomniaResource): PlannedRequest {
  return {
    name: resource.name || 'Imported request',
    method: toMethod(resource.method),
    url: resource.url ?? '',
    params: toKeyValuePairs(resource.parameters),
    headers: toKeyValuePairs(resource.headers),
    auth: toAuth(resource.authentication),
    body: toBody(resource.body),
    assertions: [],
    variables: [],
  }
}

/** Parses an Insomnia v4 export (`{_type: "export", resources: [...]}`) into the same `CollectionPlan` shape Postman/OpenAPI import produce. */
export function parseInsomniaExport(raw: unknown): CollectionPlan {
  const doc = raw as InsomniaExportDoc
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.resources)) {
    throw new Error('Not a valid Insomnia export (expected a "resources" array)')
  }

  const byId = new Map<string, InsomniaResource>()
  for (const resource of doc.resources) {
    if (resource._id) byId.set(resource._id, resource)
  }
  const workspace = doc.resources.find((r) => r._type === 'workspace')

  const groups = new Map<string, PlannedRequest[]>()
  for (const resource of doc.resources) {
    if (resource._type !== 'request') continue
    const tag = folderTagFor(resource.parentId, byId)
    const list = groups.get(tag) ?? []
    list.push(requestFromResource(resource))
    groups.set(tag, list)
  }

  return {
    name: workspace?.name || 'Imported Collection',
    description: workspace?.description,
    groups: [...groups.entries()].map(([tag, requests]) => ({ tag, requests })),
  }
}
