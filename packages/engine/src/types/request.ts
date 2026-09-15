export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export interface KeyValuePair {
  id: string
  key: string
  value: string
  enabled: boolean
  /** Values flagged secret are masked in the UI and never rendered in plaintext. */
  secret?: boolean
}

export type AuthType =
  | 'none'
  | 'apiKey'
  | 'bearer'
  | 'basic'
  | 'oauth2'
  | 'jwt'
  | 'aws'
  | 'custom'

export interface NoAuthConfig {
  type: 'none'
}

export interface ApiKeyAuthConfig {
  type: 'apiKey'
  /** header | query */
  location: 'header' | 'query'
  key: string
  value: string
}

export interface BearerAuthConfig {
  type: 'bearer'
  token: string
}

export interface BasicAuthConfig {
  type: 'basic'
  username: string
  password: string
}

export interface OAuth2Config {
  type: 'oauth2'
  grantType: 'client_credentials' | 'authorization_code' | 'password'
  tokenUrl: string
  authUrl?: string
  clientId: string
  clientSecret: string
  scopes: string
  accessToken: string
  /** Ms-epoch expiry of `accessToken`, set after a real client-credentials fetch (from the token response's `expires_in`). Undefined for a manually-pasted token. */
  tokenExpiresAt?: number
}

export interface JwtAuthConfig {
  type: 'jwt'
  token: string
}

export interface AwsAuthConfig {
  type: 'aws'
  accessKey: string
  secretKey: string
  region: string
  service: string
}

export interface CustomAuthConfig {
  type: 'custom'
  instructions: string
}

export type AuthConfig =
  | NoAuthConfig
  | ApiKeyAuthConfig
  | BearerAuthConfig
  | BasicAuthConfig
  | OAuth2Config
  | JwtAuthConfig
  | AwsAuthConfig
  | CustomAuthConfig

export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary' | 'graphql'

export type RawLanguage = 'json' | 'xml' | 'text' | 'javascript' | 'html'

export type RequestBody =
  | { type: 'none' }
  | { type: 'form-data'; pairs: KeyValuePair[] }
  | { type: 'x-www-form-urlencoded'; pairs: KeyValuePair[] }
  | { type: 'raw'; language: RawLanguage; content: string }
  | { type: 'binary'; source: string }
  | { type: 'graphql'; query: string; variables: string }

export interface RequestScripts {
  preRequest: string
  postResponse: string
}

export type AssertionType =
  | 'statusCodeEquals'
  | 'responseTimeLessThan'
  | 'jsonPathExists'
  | 'jsonPathEquals'
  | 'headerExists'
  | 'schemaMatches'

export interface Assertion {
  id: string
  type: AssertionType
  /** Target property, e.g. `$.users[0].id`, header name, schema string. */
  target: string
  expected: string
  enabled: boolean
}

export interface RequestSettings {
  timeoutMs: number
  followRedirects: boolean
  maxRedirects: number
  sslVerify: boolean
}

export interface RequestModel {
  id: string
  name: string
  method: HttpMethod
  url: string
  workspaceId: string
  collectionId?: string
  folderId?: string
  params: KeyValuePair[]
  headers: KeyValuePair[]
  auth: AuthConfig
  body: RequestBody
  scripts: RequestScripts
  assertions: Assertion[]
  settings: RequestSettings
  /** Request-scoped variables, resolved with highest priority. */
  variables: KeyValuePair[]
  createdAt: number
  updatedAt: number
}

/** A blank, ready-to-edit request — the starting point for a new workspace tab. */
export function createDraftRequest(input: {
  id: string
  workspaceId: string
  method?: HttpMethod
  name?: string
  url?: string
  collectionId?: string
}): RequestModel {
  const now = Date.now()
  return {
    id: input.id,
    name: input.name ?? 'New Request',
    method: input.method ?? 'GET',
    url: input.url ?? '',
    workspaceId: input.workspaceId,
    collectionId: input.collectionId,
    params: [],
    headers: [],
    auth: { type: 'none' },
    body: { type: 'none' },
    scripts: { preRequest: '', postResponse: '' },
    assertions: [],
    settings: { timeoutMs: 30000, followRedirects: true, maxRedirects: 10, sslVerify: true },
    variables: [],
    createdAt: now,
    updatedAt: now,
  }
}