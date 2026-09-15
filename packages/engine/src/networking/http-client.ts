import { readFile } from 'node:fs/promises'
import { lookup } from 'node:dns/promises'
import { performance } from 'node:perf_hooks'
import { Agent, request as undiciRequest } from 'undici'
import type { RequestModel } from '../types/request'
import type { RedirectEntry, ResponseCookie, ResponseModel } from '../types/response'
import { resolveRequest } from './resolve-request'
import type { ExecutionContext, RequestClient } from './client'

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
 */
export class UndiciRequestClient implements RequestClient {
  async execute(request: RequestModel, ctx: ExecutionContext): Promise<ResponseModel> {
    const t0 = performance.now()
    try {
      const resolved = resolveRequest(request, ctx.variables)
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

      const dispatcher = new Agent({ connect: { rejectUnauthorized: request.settings.sslVerify } })
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
