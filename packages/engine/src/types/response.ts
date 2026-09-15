export interface TimingBreakdown {
  dns: number
  connect: number
  tls: number
  /** Time to first byte. */
  wait: number
  download: number
  total: number
}

export interface ResponseCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  /** Seconds, from a `Max-Age` attribute — takes precedence over `expires` per RFC 6265. */
  maxAge?: number
  httpOnly?: boolean
  secure?: boolean
}

/**
 * A cookie as stored in the persistent per-workspace jar — unlike
 * {@link ResponseCookie} (one response's raw `Set-Cookie` attributes, used
 * for the response viewer's Cookies tab), every field here is resolved to a
 * concrete value so the jar can be matched against a future request without
 * re-deriving anything: `domain`/`path` fall back to the request URL that set
 * the cookie when the response didn't specify them, and `expiresAt` is an
 * absolute timestamp computed from `Max-Age` or `Expires`.
 */
export interface JarCookie {
  name: string
  value: string
  domain: string
  /** True when the response set no `Domain` attribute — RFC 6265 host-only cookie, matches the exact host only (no subdomains). */
  hostOnly: boolean
  path: string
  secure: boolean
  httpOnly: boolean
  /** Absolute ms-epoch expiry; undefined means a session cookie (kept until cleared — there is no browser "session" to end it). */
  expiresAt?: number
  createdAt: number
}

export interface RedirectEntry {
  url: string
  status: number
}

export interface ClientError {
  code: string
  message: string
  cause?: string
}

export interface ResponseModel {
  requestId?: string
  status: number
  statusText: string
  headers: Record<string, string>
  /** Parsed body when the content type is JSON. */
  body?: unknown
  /** Raw body text. */
  bodyText: string
  size: number
  timeMs: number
  timing: TimingBreakdown
  cookies: ResponseCookie[]
  redirects: RedirectEntry[]
  error?: ClientError
  handledByMock?: boolean
}