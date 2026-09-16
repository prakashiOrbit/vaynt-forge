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
  | 'inherit'
  | 'none'
  | 'apiKey'
  | 'bearer'
  | 'basic'
  | 'oauth2'
  | 'oauth1'
  | 'digest'
  | 'jwt'
  | 'aws'
  | 'custom'

/** Uses the nearest parent folder's (or the collection's) auth — resolved before a real request ever goes out; never reaches `applyAuth` with anything to contribute itself. */
export interface InheritAuthConfig {
  type: 'inherit'
}

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

/**
 * RFC 2617/7616 Digest auth. Only credentials are configured here — the
 * realm/nonce/qop/algorithm come from the server's `WWW-Authenticate`
 * challenge on a real 401 response, so signing happens request-by-request
 * in the real HTTP client, not from this static config alone.
 */
export interface DigestAuthConfig {
  type: 'digest'
  username: string
  password: string
}

/** RFC 5849 OAuth 1.0a request signing. */
export interface OAuth1Config {
  type: 'oauth1'
  consumerKey: string
  consumerSecret: string
  /** Access token — omit for the (rare) two-legged flow. */
  token: string
  tokenSecret: string
  signatureMethod: 'HMAC-SHA1' | 'PLAINTEXT'
}

export interface AwsAuthConfig {
  type: 'aws'
  accessKey: string
  secretKey: string
  region: string
  service: string
  /** STS temporary-credential session token — sent as `X-Amz-Security-Token` alongside the SigV4 signature. */
  sessionToken?: string
}

export interface CustomAuthConfig {
  type: 'custom'
  instructions: string
}

export type AuthConfig =
  | InheritAuthConfig
  | NoAuthConfig
  | ApiKeyAuthConfig
  | BearerAuthConfig
  | BasicAuthConfig
  | OAuth2Config
  | OAuth1Config
  | DigestAuthConfig
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