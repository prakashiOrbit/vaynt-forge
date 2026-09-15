import type { RequestModel } from '../types/request'
import type { ResponseModel, TimingBreakdown } from '../types/response'
import type { ResolutionContext } from '../types/variables'
import { resolveRequest } from './resolve-request'

export interface ExecutionContext {
  environment?: string
  variables: ResolutionContext
}

/** Core contract — the real client (undici etc.) implements this in Sprint 6. */
export interface RequestClient {
  execute(request: RequestModel, ctx: ExecutionContext): Promise<ResponseModel>
}

const SAMPLE_OK: Omit<ResponseModel, 'requestId' | 'timing'> = {
  status: 200,
  statusText: 'OK',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'server': 'cloudflare',
    'x-request-id': 'req_01J3mXyZ8cUQp9nEwm2514GzZ6',
    'via': '1.1 vegur',
  },
  bodyText: JSON.stringify(
    {
      data: [
        { id: 'usr_1024', name: 'Sarah Chen', email: 'sarah.chen@acme.dev', status: 'active' },
        { id: 'usr_1025', name: 'Michael Ross', email: 'michael.ross@acme.dev', status: 'active' },
      ],
      pagination: { page: 1, limit: 20, total: 142 },
    },
    null,
    2
  ),
  size: 224,
  timeMs: 124,
  cookies: [],
  redirects: [],
  handledByMock: true,
}

const SAMPLE_500: Omit<ResponseModel, 'requestId' | 'timing'> = {
  status: 500,
  statusText: 'Internal Server Error',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'server': 'acme-gateway',
    'x-request-id': 'req_01J3nxQ7zRcJp9kFsGm5vWxY21',
  },
  bodyText: JSON.stringify(
    {
      error: { code: 'DATABASE_TIMEOUT', message: 'Unable to complete database operation' },
    },
    null,
    2
  ),
  size: 92,
  timeMs: 923,
  cookies: [],
  redirects: [],
  handledByMock: true,
}

const TIMING_OK: TimingBreakdown = { dns: 3, connect: 5, tls: 12, wait: 94, download: 10, total: 124 }
const TIMING_500: TimingBreakdown = {
  dns: 4,
  connect: 8,
  tls: 16,
  wait: 881,
  download: 14,
  total: 923,
}
const TIMING_REDIRECT: TimingBreakdown = { dns: 3, connect: 5, tls: 12, wait: 138, download: 12, total: 170 }

const SAMPLE_REDIRECT: Omit<ResponseModel, 'requestId' | 'timing'> = {
  status: 200,
  statusText: 'OK',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    server: 'cloudflare',
  },
  bodyText: JSON.stringify({ message: 'Resource has moved — you are now viewing the current location.' }, null, 2),
  size: 88,
  timeMs: 170,
  cookies: [],
  redirects: [],
  handledByMock: true,
}

/**
 * Sprint 0 mock client, extended in Sprint 6 with real variable/auth
 * resolution (via {@link resolveRequest}), a redirect-chain demo, and honest
 * error responses for unparseable URLs. Still fabricates the actual HTTP
 * response — see {@link UndiciRequestClient} for the real network client,
 * and DEVELOPMENT_ROADMAP.md's "Out of Scope" note for why the Send button
 * uses this one instead: demo requests target `api.acme.dev`, which doesn't
 * resolve, so a real client would just fail every demo request with ENOTFOUND.
 */
export class MockRequestClient implements RequestClient {
  async execute(request: RequestModel, ctx: ExecutionContext): Promise<ResponseModel> {
    let resolvedUrl: string
    try {
      resolvedUrl = resolveRequest(request, ctx.variables).url
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        requestId: request.id,
        status: 0,
        statusText: 'Error',
        headers: {},
        bodyText: '',
        size: 0,
        timeMs: 0,
        timing: { dns: 0, connect: 0, tls: 0, wait: 0, download: 0, total: 0 },
        cookies: [],
        redirects: [],
        error: { code: 'INVALID_URL', message: `Could not resolve a valid URL: ${message}` },
      }
    }

    const isFailure = request.method === 'POST' && /orders/i.test(resolvedUrl)
    const isRedirect = !isFailure && request.method === 'GET' && /redirect/i.test(resolvedUrl)

    await new Promise((r) => setTimeout(r, isFailure ? 320 : isRedirect ? 220 : 180))

    if (isRedirect) {
      const finalUrl = resolvedUrl.replace(/\/redirect\b/i, '/final')
      return {
        ...SAMPLE_REDIRECT,
        requestId: request.id,
        body: JSON.parse(SAMPLE_REDIRECT.bodyText),
        timing: TIMING_REDIRECT,
        redirects: [
          { url: resolvedUrl, status: 302 },
          { url: finalUrl, status: 200 },
        ],
      }
    }

    const base = isFailure ? SAMPLE_500 : SAMPLE_OK
    return {
      ...base,
      requestId: request.id,
      body: JSON.parse(base.bodyText),
      timing: isFailure ? TIMING_500 : TIMING_OK,
    }
  }
}