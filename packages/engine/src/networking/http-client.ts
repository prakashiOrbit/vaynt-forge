import { readFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { performance } from 'node:perf_hooks'
import { rootCertificates } from 'node:tls'
import { Agent, ProxyAgent, request as undiciRequest } from 'undici'
import type { Dispatcher } from 'undici'
import type { RequestModel } from '../types/request.js'
import type { RedirectEntry, ResponseCookie, ResponseModel } from '../types/response.js'
import type { ClientCertificateEntry } from '../types/settings.js'
import type { ResolutionContext } from '../types/variables.js'
import { resolveVariables } from '../variables/resolver.js'
import { resolveRequest } from './resolve-request.js'
import type { ExecutionContext, RequestClient } from './client.js'
import { buildDigestHeader, parseDigestChallenge } from './digest.js'
import { buildOAuth1Header } from './oauth1.js'
import { buildSigV4Headers } from './sigv4.js'

const resolveVar = (template: string, ctx: ResolutionContext): string => resolveVariables(template, ctx).value

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function parseCookies(headers: Record<string, string | string[] | undefined>): ResponseCookie[] {
  const raw = headers['set-cookie']
  const list = Array.isArray(raw) ? raw : raw ? [raw] : []
  return list.map((line) => {
    const [pair, ...attrs] = line.split(';').map((s) => s.trim())
    const eq = (pair ?? '').indexOf('=')
    const name = eq === -1 ? (pair ?? '') : pair!.slice(0, eq)
    const value = eq === -1 ? '' : pair!.slice(eq + 1)
    const cookie: ResponseCookie = { name, value }
    for (const attr of attrs) {
      const [k, v] = attr.split('=')
      const key = k?.toLowerCase()
      if (key === 'domain') cookie.domain = v
      else if (key === 'path') cookie.path = v
      else if (key === 'expires') cookie.expires = v
      else if (key === 'max-age' && v && !Number.isNaN(Number(v))) cookie.maxAge = Number(v)
      else if (key === 'httponly') cookie.httpOnly = true
      else if (key === 'secure') cookie.secure = true
    }
    return cookie
  })
}

function flattenHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined) continue
    out[k] = Array.isArray(v) ? v.join(', ') : v
  }
  return out
}

function effectivePort(url: URL): number {
  if (url.port) return Number(url.port)
  return url.protocol === 'https:' ? 443 : 80
}

/** Exact-hostname match (plus port, when the entry specifies one) — same matching model Postman's client-certificate manager uses. */
function findClientCertificate(entries: ClientCertificateEntry[] | undefined, url: URL): ClientCertificateEntry | undefined {
  const port = effectivePort(url)
  return entries?.find((e) => e.host === url.hostname && (e.port === undefined || e.port === port))
}

/**
 * Real `undici`-based client — genuinely performs the HTTP call, follows
 * redirects itself (to capture the full chain), and reports timing. This is
 * what the renderer's Send button calls (via `network:execute` IPC — see
 * `sendRequest.ts`), as of the post-Sprint-13 networking change. One
 * consequence: the seeded demo workspace's `api.acme.dev` requests never
 * resolved to anything real, so they'll now genuinely fail with a DNS/
 * connection error instead of returning a canned response — see
 * DEVELOPMENT_ROADMAP.md's note under Sprint 6.
 *
 * Timing note: `dns` is a genuine extra lookup done up front (accurate but
 * means the connection undici itself makes re-resolves the name — fine for a
 * path that isn't hot). Undici doesn't expose per-phase connect/TLS
 * timestamps through its public `request()` API without subscribing to
 * diagnostics_channel events whose shape has shifted across versions, so
 * `connect`/`tls` are reported as 0 and that time is folded into `wait`
 * instead of fabricating a split we can't actually measure.
 *
 * `ctx.proxy`/`ctx.caCertificates` (the workspace's Settings) genuinely
 * route the request through a real `ProxyAgent` and extend the real TLS
 * trust store — the caller (`ipc.ts`) is responsible for looking those up
 * per workspace and passing them in.
 */
export class UndiciRequestClient implements RequestClient {
  async execute(request: RequestModel, ctx: ExecutionContext): Promise<ResponseModel> {
    const t0 = performance.now()
    // Declared here (not `const` inside the try below) so the `finally`
    // block can close it — a fresh dispatcher per call that's never closed
    // leaves its keep-alive socket (and undici's idle timers) open, which
    // never mattered in the long-running desktop app but hangs a short-lived
    // process (e.g. the CLI runner) open for tens of seconds after the last
    // response, waiting for a timeout instead of exiting immediately.
    let dispatcher: Dispatcher | undefined
    try {
      const resolved = resolveRequest(request, ctx.variables)

      // OAuth 1.0a needs `node:crypto` (HMAC-SHA1) to sign — `applyAuth`
      // stays Node-free for the renderer, so the real Authorization header
      // is built here, before the request ever goes out (no challenge round
      // trip needed, unlike Digest below).
      if (request.auth.type === 'oauth1') {
        const auth = request.auth
        const bodyParams: [string, string][] =
          request.body.type === 'x-www-form-urlencoded' && resolved.body
            ? [...new URLSearchParams(resolved.body).entries()]
            : []
        resolved.headers['Authorization'] = buildOAuth1Header({
          method: resolved.method,
          url: resolved.url,
          consumerKey: resolveVar(auth.consumerKey, ctx.variables),
          consumerSecret: resolveVar(auth.consumerSecret, ctx.variables),
          token: auth.token ? resolveVar(auth.token, ctx.variables) : undefined,
          tokenSecret: auth.tokenSecret ? resolveVar(auth.tokenSecret, ctx.variables) : undefined,
          signatureMethod: auth.signatureMethod,
          bodyParams,
        })
      }

      // AWS SigV4 needs `node:crypto` (HMAC-SHA256) to sign — same reasoning
      // as OAuth 1.0a above: computed here, pre-send, no challenge round trip.
      if (request.auth.type === 'aws') {
        const auth = request.auth
        Object.assign(
          resolved.headers,
          buildSigV4Headers({
            method: resolved.method,
            url: resolved.url,
            headers: resolved.headers,
            body: resolved.body,
            accessKey: resolveVar(auth.accessKey, ctx.variables),
            secretKey: resolveVar(auth.secretKey, ctx.variables),
            sessionToken: auth.sessionToken ? resolveVar(auth.sessionToken, ctx.variables) : undefined,
            region: resolveVar(auth.region, ctx.variables),
            service: resolveVar(auth.service, ctx.variables),
          })
        )
      }

      const bodyBuf =
        request.body.type === 'binary' && request.body.source
          ? await readFile(request.body.source)
          : resolved.body

      let dnsMs = 0
      try {
        const hostname = new URL(resolved.url).hostname
        const tDns0 = performance.now()
        await lookup(hostname)
        dnsMs = performance.now() - tDns0
      } catch {
        dnsMs = 0 // IP literal, or lookup failed — the real request below will surface the real error
      }

      // A client (mTLS) certificate matched by exact host[:port] — read fresh
      // from disk each send (settings only ever store the path), same as a
      // binary request body already does. Not caught here: a missing/
      // unreadable file should surface as a real, readable error rather than
      // a silent fall-through to a confusing bare TLS handshake failure.
      let clientCertOptions: { cert?: Buffer; key?: Buffer; pfx?: Buffer; passphrase?: string } = {}
      const matchedCert = findClientCertificate(ctx.clientCertificates, new URL(resolved.url))
      if (matchedCert?.pfxPath) {
        clientCertOptions = { pfx: await readFile(matchedCert.pfxPath), passphrase: matchedCert.passphrase }
      } else if (matchedCert?.certPath && matchedCert.keyPath) {
        clientCertOptions = {
          cert: await readFile(matchedCert.certPath),
          key: await readFile(matchedCert.keyPath),
          passphrase: matchedCert.passphrase,
        }
      }

      // Extra CA certs (raw PEM) the workspace explicitly trusts get added
      // alongside — not instead of — Node's own bundled trust store, since
      // passing any `ca` array to `tls.connect` replaces the default set
      // rather than extending it.
      const connectOptions = {
        rejectUnauthorized: request.settings.sslVerify,
        ...(ctx.caCertificates && ctx.caCertificates.length > 0
          ? { ca: [...rootCertificates, ...ctx.caCertificates] }
          : {}),
        ...clientCertOptions,
      }
      dispatcher =
        ctx.proxy?.enabled && ctx.proxy.host
          ? new ProxyAgent({ uri: `http://${ctx.proxy.host}:${ctx.proxy.port}`, connect: connectOptions })
          : new Agent({ connect: connectOptions })
      const redirects: RedirectEntry[] = []
      let currentUrl = resolved.url
      let currentMethod = resolved.method
      let currentBody = bodyBuf
      const maxHops = request.settings.followRedirects ? Math.max(0, request.settings.maxRedirects) : 0

      const tHeaders0 = performance.now()
      let res: Awaited<ReturnType<typeof undiciRequest>> | undefined
      for (let hop = 0; hop <= maxHops; hop++) {
        res = await undiciRequest(currentUrl, {
          method: currentMethod as never,
          headers: resolved.headers,
          body: currentBody,
          dispatcher,
          headersTimeout: request.settings.timeoutMs,
          bodyTimeout: request.settings.timeoutMs,
        })
        if (REDIRECT_STATUSES.has(res.statusCode) && hop < maxHops) {
          const location = res.headers.location
          if (!location || Array.isArray(location)) break
          redirects.push({ url: currentUrl, status: res.statusCode })
          currentUrl = new URL(location, currentUrl).toString()
          if (res.statusCode === 303) {
            currentMethod = 'GET'
            currentBody = undefined
          }
          await res.body.dump().catch(() => {})
          continue
        }
        break
      }
      if (!res) throw new Error('No response received')

      // Digest auth is inherently a two-request protocol: the server has to
      // issue a 401 with a `WWW-Authenticate: Digest ...` challenge (realm,
      // nonce, qop) before a response hash can even be computed, so this is
      // the one auth type that can't be pre-applied — it's signed here, once,
      // after seeing the real challenge, then the same request is resent.
      if (request.auth.type === 'digest' && res.statusCode === 401) {
        const challenge = parseDigestChallenge(flattenHeaders(res.headers)['www-authenticate'])
        if (challenge) {
          const auth = request.auth
          const uri = new URL(currentUrl).pathname + new URL(currentUrl).search
          const digestHeader = buildDigestHeader({
            username: resolveVar(auth.username, ctx.variables),
            password: resolveVar(auth.password, ctx.variables),
            method: currentMethod,
            uri,
            body: typeof currentBody === 'string' ? currentBody : currentBody?.toString('utf8'),
            challenge,
          })
          await res.body.dump().catch(() => {})
          res = await undiciRequest(currentUrl, {
            method: currentMethod as never,
            headers: { ...resolved.headers, Authorization: digestHeader },
            body: currentBody,
            dispatcher,
            headersTimeout: request.settings.timeoutMs,
            bodyTimeout: request.settings.timeoutMs,
          })
        }
      }

      const waitMs = performance.now() - tHeaders0
      const tBody0 = performance.now()
      const bodyBytes = Buffer.from(await res.body.arrayBuffer())
      const downloadMs = performance.now() - tBody0

      const bodyText = bodyBytes.toString('utf-8')
      const total = performance.now() - t0
      const headers = flattenHeaders(res.headers)

      return {
        requestId: request.id,
        status: res.statusCode,
        statusText: statusTextFor(res.statusCode),
        headers,
        body: tryParseJson(bodyText),
        bodyText,
        size: bodyBytes.byteLength,
        timeMs: Math.round(total),
        timing: {
          dns: Math.round(dnsMs),
          connect: 0,
          tls: 0,
          wait: Math.round(Math.max(0, waitMs)),
          download: Math.round(Math.max(0, downloadMs)),
          total: Math.round(total),
        },
        cookies: parseCookies(res.headers as Record<string, string | string[] | undefined>),
        redirects,
      }
    } catch (err) {
      const total = performance.now() - t0
      const message = err instanceof Error ? err.message : String(err)
      return {
        requestId: request.id,
        status: 0,
        statusText: 'Error',
        headers: {},
        bodyText: '',
        size: 0,
        timeMs: Math.round(total),
        timing: { dns: 0, connect: 0, tls: 0, wait: 0, download: 0, total: Math.round(total) },
        cookies: [],
        redirects: [],
        error: { code: errorCode(err), message },
      }
    } finally {
      await dispatcher?.close().catch(() => {})
    }
  }
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function errorCode(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: string }).code
  }
  return 'NETWORK_ERROR'
}

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  303: 'See Other',
  307: 'Temporary Redirect',
  308: 'Permanent Redirect',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
}

function statusTextFor(status: number): string {
  return STATUS_TEXT[status] ?? ''
}
