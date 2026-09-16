type Json = Record<string, unknown>

function isJson(o: unknown): o is Json {
  return typeof o === 'object' && o !== null
}

const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

function synthesizeServers(doc: Json): unknown[] {
  const host = typeof doc.host === 'string' ? doc.host : undefined
  if (!host) return []
  const basePath = typeof doc.basePath === 'string' ? doc.basePath : ''
  const schemes = Array.isArray(doc.schemes) && doc.schemes.length > 0 ? doc.schemes : ['https']
  return schemes.map((scheme) => ({ url: `${scheme}://${host}${basePath}` }))
}

/** Swagger 2.0's `securityDefinitions` is shaped like OpenAPI 3's `securitySchemes` for `apiKey`,
 * but `basic` needs remapping to 3's `http`/`scheme: basic`, and `oauth2`'s per-flow fields
 * (`flow`, `authorizationUrl`, `tokenUrl`, top-level `scopes`) have no equivalent read anywhere in
 * this parser today (`OpenApiSecurityScheme` only tracks name/type/scheme/in/description), so they're
 * dropped rather than partially mapped. */
function normalizeSecurityDefinitions(node: unknown): Json {
  if (!isJson(node)) return {}
  const out: Json = {}
  for (const [name, raw] of Object.entries(node)) {
    if (!isJson(raw)) continue
    const type = raw.type
    if (type === 'basic') {
      out[name] = { type: 'http', scheme: 'basic', description: raw.description }
    } else {
      out[name] = raw
    }
  }
  return out
}

/** Swagger 2.0 has no `content`-typed request/response bodies: a body arrives as a single
 * `in: "body"` parameter (whole schema), form fields as `in: "formData"` parameters, and the
 * content type comes from `consumes`/`produces` rather than a per-media-type map. This rewrites
 * one operation into the OpenAPI 3-shaped `requestBody`/`responses[status].content` this parser
 * already understands, so the rest of `parser.ts` needs no Swagger-2-specific branches at all. */
function normalizeOperation(opRaw: Json, docConsumes: unknown, docProduces: unknown): Json {
  const params = Array.isArray(opRaw.parameters) ? opRaw.parameters.filter(isJson) : []
  const bodyParam = params.find((p) => p.in === 'body')
  const formParams = params.filter((p) => p.in === 'formData')
  const otherParams = params.filter((p) => p.in !== 'body' && p.in !== 'formData')

  const consumes = Array.isArray(opRaw.consumes) ? opRaw.consumes : Array.isArray(docConsumes) ? docConsumes : ['application/json']
  const produces = Array.isArray(opRaw.produces) ? opRaw.produces : Array.isArray(docProduces) ? docProduces : ['application/json']

  let requestBody: Json | undefined
  if (bodyParam) {
    requestBody = { content: { [String(consumes[0])]: { schema: bodyParam.schema } } }
  } else if (formParams.length > 0) {
    const properties: Json = {}
    const required: string[] = []
    for (const p of formParams) {
      properties[String(p.name)] = { type: p.type ?? 'string' }
      if (p.required) required.push(String(p.name))
    }
    const contentType = consumes.includes('multipart/form-data') ? 'multipart/form-data' : 'application/x-www-form-urlencoded'
    requestBody = { content: { [contentType]: { schema: { type: 'object', properties, required } } } }
  }

  const responses: Json = {}
  const responsesNode = isJson(opRaw.responses) ? opRaw.responses : {}
  for (const [status, respRaw] of Object.entries(responsesNode)) {
    if (!isJson(respRaw)) continue
    if (respRaw.schema !== undefined) {
      responses[status] = {
        description: respRaw.description,
        content: { [String(produces[0])]: { schema: respRaw.schema, examples: respRaw.examples } },
      }
    } else {
      responses[status] = respRaw
    }
  }

  return {
    ...opRaw,
    parameters: otherParams,
    requestBody,
    responses,
  }
}

/** Normalizes a Swagger 2.0 (OpenAPI 2.0) document into the OpenAPI 3.0-shaped `Json` this
 * module's parser already handles — `$ref`s are left untouched (`#/definitions/*` resolves fine
 * as-is, since `resolveRef` just walks whatever path segments the ref string contains). */
export function normalizeSwagger2(doc: Json): Json {
  const pathsNode = isJson(doc.paths) ? doc.paths : {}
  const paths: Json = {}
  for (const [path, pathItemRaw] of Object.entries(pathsNode)) {
    if (!isJson(pathItemRaw)) continue
    const pathItem: Json = { ...pathItemRaw }
    for (const method of METHODS) {
      const opRaw = pathItemRaw[method]
      if (isJson(opRaw)) pathItem[method] = normalizeOperation(opRaw, doc.consumes, doc.produces)
    }
    paths[path] = pathItem
  }

  return {
    ...doc,
    servers: synthesizeServers(doc),
    paths,
    components: {
      ...(isJson(doc.components) ? doc.components : {}),
      securitySchemes: normalizeSecurityDefinitions(doc.securityDefinitions),
    },
  }
}
