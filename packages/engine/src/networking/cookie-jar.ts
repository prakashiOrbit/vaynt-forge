import type { JarCookie, ResponseCookie } from '../types/response.js'

/** RFC 6265 §5.1.4 default-path algorithm, simplified: the request path up to (not including) its last `/`, or `/` if there isn't one past the first character. */
function defaultPath(requestPath: string): string {
  if (!requestPath.startsWith('/')) return '/'
  const lastSlash = requestPath.lastIndexOf('/')
  if (lastSlash <= 0) return '/'
  return requestPath.slice(0, lastSlash)
}

/** RFC 6265 §5.1.3 domain-match: exact host match, or `host` is a subdomain of `cookieDomain`. */
function domainMatches(host: string, cookieDomain: string, hostOnly: boolean): boolean {
  const h = host.toLowerCase()
  const d = cookieDomain.toLowerCase()
  if (h === d) return true
  return !hostOnly && h.endsWith(`.${d}`)
}

/** RFC 6265 §5.1.4 path-match: exact match, or `cookiePath` is a proper directory prefix of `requestPath`. */
function pathMatches(requestPath: string, cookiePath: string): boolean {
  if (requestPath === cookiePath) return true
  if (!requestPath.startsWith(cookiePath)) return false
  if (cookiePath.endsWith('/')) return true
  return requestPath[cookiePath.length] === '/'
}

/**
 * Resolves a response's raw `Set-Cookie` attributes (which may omit Domain/
 * Path entirely, per spec, in which case they default from the request that
 * received them) into jar-ready cookies with everything concrete. A cookie
 * whose `Max-Age`/`Expires` already puts it in the past (a deletion cookie,
 * e.g. `Max-Age=0`) is dropped here rather than ever entering the jar.
 */
export function cookiesFromResponse(cookies: ResponseCookie[], requestUrl: string, now: number): JarCookie[] {
  let url: URL
  try {
    url = new URL(requestUrl)
  } catch {
    return []
  }
  const out: JarCookie[] = []
  for (const c of cookies) {
    if (!c.name) continue
    const hostOnly = !c.domain
    const domain = c.domain ? c.domain.replace(/^\./, '') : url.hostname
    const path = c.path || defaultPath(url.pathname)
    let expiresAt: number | undefined
    if (typeof c.maxAge === 'number') {
      expiresAt = now + c.maxAge * 1000
    } else if (c.expires) {
      const parsed = Date.parse(c.expires)
      if (!Number.isNaN(parsed)) expiresAt = parsed
    }
    if (expiresAt !== undefined && expiresAt <= now) continue // deletion cookie — never store it
    out.push({
      name: c.name,
      value: c.value,
      domain,
      hostOnly,
      path,
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      expiresAt,
      createdAt: now,
    })
  }
  return out
}

/** Prunes cookies whose `expiresAt` has passed. */
export function pruneExpired(jar: JarCookie[], now: number): JarCookie[] {
  return jar.filter((c) => c.expiresAt === undefined || c.expiresAt > now)
}

/**
 * Merges freshly-received cookies into the jar: same name+domain+path
 * replaces the old value (a real re-login should overwrite a stale session
 * cookie, not duplicate it), everything else is kept, and anything expired
 * is swept out while we're here.
 */
export function mergeIntoJar(jar: JarCookie[], incoming: JarCookie[], now: number): JarCookie[] {
  const key = (c: JarCookie) => `${c.name}\0${c.domain}\0${c.path}`
  const incomingKeys = new Set(incoming.map(key))
  const kept = pruneExpired(jar, now).filter((c) => !incomingKeys.has(key(c)))
  return [...kept, ...incoming]
}

/**
 * The `Cookie` header value the jar contributes for a request to `url` — every
 * stored cookie whose domain/path match, that isn't expired, and that isn't
 * `Secure`-only on a plain `http:` request. Returns `undefined` (not an empty
 * string) when nothing matches, so callers can skip adding the header at all.
 */
export function cookieHeaderForUrl(jar: JarCookie[], url: string, now: number): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }
  const isSecureContext = parsed.protocol === 'https:'
  const matches = jar.filter(
    (c) =>
      (c.expiresAt === undefined || c.expiresAt > now) &&
      domainMatches(parsed.hostname, c.domain, c.hostOnly) &&
      pathMatches(parsed.pathname, c.path) &&
      (!c.secure || isSecureContext)
  )
  if (matches.length === 0) return undefined
  return matches.map((c) => `${c.name}=${c.value}`).join('; ')
}
