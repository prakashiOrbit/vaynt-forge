import type { RequestModel } from '../types/request'
import type { ResponseModel, TimingBreakdown } from '../types/response'
import type { ResolutionContext } from '../types/variables'
import { resolveVariables } from '../variables/resolver'

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

/**
 * Sprint 0 mock client. Simulates execution with a short latency and returns
 * the sample success (200) / failure (500) responses from the product spec.
 * Replaced by a real `undici`-based client in Sprint 6 — contract stays identical.
 */
export class MockRequestClient implements RequestClient {
  async execute(request: RequestModel, _ctx: ExecutionContext): Promise<ResponseModel> {
    const resolvedUrl = resolveVariables(request.url, _ctx.variables).value
    const isFailure = request.method === 'POST' && /orders/i.test(resolvedUrl)

    await new Promise((r) => setTimeout(r, isFailure ? 320 : 180))

    const base = isFailure ? SAMPLE_500 : SAMPLE_OK
    return {
      ...base,
      requestId: request.id,
      body: JSON.parse(base.bodyText),
      timing: isFailure ? TIMING_500 : TIMING_OK,
    }
  }
}