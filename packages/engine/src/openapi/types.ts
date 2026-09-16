/**
 * A parsed, UI-ready view of an OpenAPI 3.0.x/3.1.x or Swagger 2.0 document —
 * deliberately not a full OpenAPI type system (`$ref` only resolved for local
 * references, no 3.1 `webhooks`/`components.pathItems`). Swagger 2.0 sources
 * are normalized (see `swagger2.ts`) into this same shape before parsing, so
 * `sourceDialect` is the only trace of which format the raw text was in.
 * Covers what the Explorer/Documentation viewer/generators actually need.
 */
export interface OpenApiInfo {
  title: string
  version: string
  description?: string
}

export interface OpenApiServer {
  url: string
  description?: string
}

export interface OpenApiSecurityScheme {
  name: string
  type: string
  scheme?: string
  in?: string
  description?: string
}

export interface OpenApiParameter {
  name: string
  in: 'path' | 'query' | 'header' | 'cookie'
  required: boolean
  description?: string
  schemaType?: string
  example?: string
}

export interface OpenApiMediaExample {
  contentType: string
  schema?: unknown
  example?: string
}

export interface OpenApiResponse {
  status: string
  description?: string
  content: OpenApiMediaExample[]
}

export interface OpenApiOperation {
  operationId: string
  method: string
  path: string
  summary?: string
  description?: string
  tags: string[]
  parameters: OpenApiParameter[]
  requestBody?: OpenApiMediaExample
  responses: OpenApiResponse[]
}

export interface OpenApiTag {
  name: string
  description?: string
}

export interface ParsedOpenApiSpec {
  info: OpenApiInfo
  servers: OpenApiServer[]
  securitySchemes: OpenApiSecurityScheme[]
  tags: OpenApiTag[]
  operations: OpenApiOperation[]
  /** Which raw format this was parsed from — `swagger2` sources were normalized before parsing (see `swagger2.ts`). */
  sourceDialect: 'openapi' | 'swagger2'
}

/** The persisted entity — we store the raw text and re-parse on load, not a
 * cached parsed blob, so re-parsing always reflects the latest parser. */
export interface OpenApiSpec {
  id: string
  workspaceId: string
  name: string
  format: 'json' | 'yaml'
  raw: string
  sourceUrl?: string
  createdAt: number
  updatedAt: number
}
