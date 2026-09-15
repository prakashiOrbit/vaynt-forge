import yaml from 'js-yaml'
import type {
  OpenApiMediaExample,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiResponse,
  OpenApiSecurityScheme,
  OpenApiTag,
  ParsedOpenApiSpec,
} from './types'

type Json = Record<string, unknown>

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

function isJson(o: unknown): o is Json {
  return typeof o === 'object' && o !== null
}

/** JSON always parses as JSON; YAML is a superset so try JSON first, then YAML. */
export function parseOpenApiText(text: string): Json {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) return JSON.parse(trimmed) as Json
  try {
    return JSON.parse(trimmed) as Json
  } catch {
    const parsed = yaml.load(trimmed)
    if (!isJson(parsed)) throw new Error('Document did not parse to an object')
    return parsed
  }
}

/** Resolves local `#/components/schemas/Name` refs, one level, with a cycle guard. */
function resolveRef(node: unknown, root: Json, depth = 0): unknown {
  if (depth > 10 || !isJson(node)) return node
  const ref = node['$ref']
  if (typeof ref === 'string' && ref.startsWith('#/')) {
    const path = ref.slice(2).split('/')
    let cursor: unknown = root
    for (const seg of path) {
      if (!isJson(cursor)) return undefined
      cursor = cursor[seg]
    }
    return resolveRef(cursor, root, depth + 1)
  }
  return node
}

/** Synthesizes a plausible example value from a (possibly ref'd) JSON Schema. */
function synthesizeExample(schema: unknown, root: Json, depth = 0): unknown {
  const resolved = resolveRef(schema, root)
  if (depth > 6 || !isJson(resolved)) return null
  if ('example' in resolved) return resolved['example']
  const type = resolved['type']
  if (type === 'object' || (!type && isJson(resolved['properties']))) {
    const props = isJson(resolved['properties']) ? resolved['properties'] : {}
    const out: Json = {}
    for (const [key, propSchema] of Object.entries(props)) out[key] = synthesizeExample(propSchema, root, depth + 1)
    return out
  }
  if (type === 'array') {
    const items = resolved['items']
    return items ? [synthesizeExample(items, root, depth + 1)] : []
  }
  if (type === 'string') return (resolved['enum'] as unknown[] | undefined)?.[0] ?? 'string'
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return true
  return null
}

function mediaExamples(contentNode: unknown, root: Json): OpenApiMediaExample[] {
  if (!isJson(contentNode)) return []
  return Object.entries(contentNode).map(([contentType, mediaTypeObj]) => {
    const media = isJson(mediaTypeObj) ? mediaTypeObj : {}
    const schema = media['schema']
    const explicitExample = media['example']
    const examplesMap = media['examples']
    let example = explicitExample
    if (example === undefined && isJson(examplesMap)) {
      const first = Object.values(examplesMap)[0]
      if (isJson(first)) example = first['value']
    }
    if (example === undefined && schema !== undefined) example = synthesizeExample(schema, root)
    return {
      contentType,
      schema: schema !== undefined ? resolveRef(schema, root) : undefined,
      example: example !== undefined ? JSON.stringify(example, null, 2) : undefined,
    }
  })
}

function parseParameters(paramsNode: unknown, root: Json): OpenApiParameter[] {
  if (!Array.isArray(paramsNode)) return []
  return paramsNode.map((p) => {
    const resolved = resolveRef(p, root)
    const param = isJson(resolved) ? resolved : {}
    const schema = isJson(param['schema']) ? param['schema'] : undefined
    return {
      name: String(param['name'] ?? ''),
      in: (param['in'] as OpenApiParameter['in']) ?? 'query',
      required: Boolean(param['required']),
      description: typeof param['description'] === 'string' ? param['description'] : undefined,
      schemaType: schema && typeof schema['type'] === 'string' ? (schema['type'] as string) : undefined,
      example: schema ? JSON.stringify(synthesizeExample(schema, root)) : undefined,
    }
  })
}

function parseResponses(responsesNode: unknown, root: Json): OpenApiResponse[] {
  if (!isJson(responsesNode)) return []
  return Object.entries(responsesNode).map(([status, respNode]) => {
    const resolved = resolveRef(respNode, root)
    const resp = isJson(resolved) ? resolved : {}
    return {
      status,
      description: typeof resp['description'] === 'string' ? resp['description'] : undefined,
      content: mediaExamples(resp['content'], root),
    }
  })
}

export function parseOpenApiSpec(doc: Json): ParsedOpenApiSpec {
  const info = isJson(doc.info) ? doc.info : {}
  const tagsRaw = Array.isArray(doc.tags) ? doc.tags : []
  const tags: OpenApiTag[] = tagsRaw
    .filter(isJson)
    .map((t) => ({ name: String(t.name ?? ''), description: typeof t.description === 'string' ? t.description : undefined }))

  const components = isJson(doc.components) ? doc.components : {}
  const securitySchemesNode = isJson(components.securitySchemes) ? components.securitySchemes : {}
  const securitySchemes: OpenApiSecurityScheme[] = Object.entries(securitySchemesNode)
    .filter(([, v]) => isJson(v))
    .map(([name, v]) => {
      const s = v as Json
      return {
        name,
        type: String(s.type ?? ''),
        scheme: typeof s.scheme === 'string' ? s.scheme : undefined,
        in: typeof s.in === 'string' ? s.in : undefined,
        description: typeof s.description === 'string' ? s.description : undefined,
      }
    })

  const pathsNode = isJson(doc.paths) ? doc.paths : {}
  const operations: OpenApiOperation[] = []
  const seenTags = new Set(tags.map((t) => t.name))

  for (const [path, pathItemRaw] of Object.entries(pathsNode)) {
    if (!isJson(pathItemRaw)) continue
    const sharedParams = Array.isArray(pathItemRaw.parameters) ? pathItemRaw.parameters : []
    for (const method of METHODS) {
      const opRaw = pathItemRaw[method]
      if (!isJson(opRaw)) continue
      const opTags = Array.isArray(opRaw.tags) ? opRaw.tags.map(String) : []
      for (const t of opTags) if (!seenTags.has(t)) seenTags.add(t)
      const requestBodyNode = isJson(opRaw.requestBody) ? resolveRef(opRaw.requestBody, doc) : undefined
      const requestBodyContent = isJson(requestBodyNode) ? mediaExamples(requestBodyNode.content, doc) : []

      operations.push({
        operationId: typeof opRaw.operationId === 'string' ? opRaw.operationId : `${method}_${path}`,
        method: method.toUpperCase(),
        path,
        summary: typeof opRaw.summary === 'string' ? opRaw.summary : undefined,
        description: typeof opRaw.description === 'string' ? opRaw.description : undefined,
        tags: opTags.length > 0 ? opTags : ['General'],
        parameters: [...parseParameters(sharedParams, doc), ...parseParameters(opRaw.parameters, doc)],
        requestBody: requestBodyContent[0],
        responses: parseResponses(opRaw.responses, doc),
      })
    }
  }

  const allTags: OpenApiTag[] = [...tags]
  for (const name of seenTags) if (!tags.some((t) => t.name === name)) allTags.push({ name })

  return {
    info: {
      title: typeof info.title === 'string' ? info.title : 'Untitled API',
      version: typeof info.version === 'string' ? info.version : '0.0.0',
      description: typeof info.description === 'string' ? info.description : undefined,
    },
    servers: Array.isArray(doc.servers)
      ? doc.servers.filter(isJson).map((s) => ({ url: String(s.url ?? ''), description: typeof s.description === 'string' ? s.description : undefined }))
      : [],
    securitySchemes,
    tags: allTags,
    operations,
  }
}
