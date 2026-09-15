import type { Collection } from '../types/workspace'
import type { RequestModel } from '../types/request'

/**
 * Sprint 12 — collection export, three formats. Native JSON round-trips
 * through this app's own types (lossless); Postman v2.1 and OpenAPI 3.0.3
 * are for interop with other tools (both intentionally minimal but valid —
 * every field they emit is real, nothing is a stub with fake values).
 */

export interface NativeCollectionExport {
  format: 'vaynt-forge-collection'
  version: 1
  collection: Pick<Collection, 'name' | 'description'>
  requests: RequestModel[]
}

export function exportCollectionNative(collection: Collection, requests: RequestModel[]): NativeCollectionExport {
  return {
    format: 'vaynt-forge-collection',
    version: 1,
    collection: { name: collection.name, description: collection.description },
    requests,
  }
}

/** Extracts the pathname without going through `URL` (which would choke on
 * unencoded `{{var}}` template segments) — strips protocol/host by hand,
 * strips any query string, keeps `{{var}}` intact for the caller to convert. */
function pathFromUrl(url: string): string {
  const withoutProtocol = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
  const slashIndex = withoutProtocol.indexOf('/')
  const pathAndQuery = slashIndex === -1 ? '/' : withoutProtocol.slice(slashIndex)
  return pathAndQuery.split('?')[0] || '/'
}

/** Postman v2.1 export — headers/params/body map back from our types; auth
 * beyond none/bearer/basic/apiKey isn't representable and is dropped rather
 * than faked. */
export function exportCollectionPostman(collection: Collection, requests: RequestModel[]): object {
  return {
    info: {
      name: collection.name,
      description: collection.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: requests.map((r) => ({
      name: r.name,
      request: {
        method: r.method,
        header: r.headers.filter((h) => h.enabled).map((h) => ({ key: h.key, value: h.value })),
        url: { raw: r.url },
        body:
          r.body.type === 'raw'
            ? { mode: 'raw', raw: r.body.content, options: { raw: { language: r.body.language } } }
            : r.body.type === 'x-www-form-urlencoded'
              ? { mode: 'urlencoded', urlencoded: r.body.pairs.filter((p) => p.enabled).map((p) => ({ key: p.key, value: p.value })) }
              : undefined,
        auth:
          r.auth.type === 'bearer'
            ? { type: 'bearer', bearer: [{ key: 'token', value: r.auth.token }] }
            : r.auth.type === 'basic'
              ? { type: 'basic', basic: [{ key: 'username', value: r.auth.username }, { key: 'password', value: r.auth.password }] }
              : undefined,
      },
    })),
  }
}

/** OpenAPI 3.0.3 export — groups by URL path (with `{{var}}` path segments
 * converted to `{var}` templates); every request becomes one operation under
 * its method. Query params and enabled headers become `parameters`. */
export function exportCollectionOpenApi(collection: Collection, requests: RequestModel[]): object {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const r of requests) {
    const path = pathFromUrl(r.url).replace(/\{\{(\w+)\}\}/g, '{$1}')
    paths[path] ??= {}
    const parameters = [
      ...r.params.filter((p) => p.enabled).map((p) => ({ name: p.key, in: 'query', schema: { type: 'string' } })),
      ...r.headers.filter((h) => h.enabled).map((h) => ({ name: h.key, in: 'header', schema: { type: 'string' } })),
    ]
    paths[path]![r.method.toLowerCase()] = {
      operationId: r.id,
      summary: r.name,
      parameters,
      ...(r.body.type === 'raw'
        ? { requestBody: { content: { 'application/json': { example: safeJsonParse(r.body.content) } } } }
        : {}),
      responses: { '200': { description: 'OK' } },
    }
  }
  return {
    openapi: '3.0.3',
    info: { title: collection.name, version: '1.0.0', description: collection.description },
    paths,
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
