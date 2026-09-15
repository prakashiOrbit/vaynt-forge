import type { ResponseModel } from '../types/response'

/**
 * Sprint 11 — the API Debugger's failure diagnosis. Same status-code causes
 * the response panel's inline error card has always shown (see
 * `ResponseError.tsx`); centralised here so the Debugger workspace and the
 * inline card stay in sync and the heuristics are actually testable.
 */
const CAUSES_BY_STATUS: Record<number, string[]> = {
  400: ['The request body or query params failed validation', 'A required field is missing or malformed'],
  401: ['The auth token is missing, expired, or invalid', 'The wrong auth type is configured for this API'],
  403: ['The credentials are valid but lack permission for this resource', 'An IP allowlist or WAF rule is blocking the request'],
  404: ['The path or resource id is wrong', 'The resource was deleted or never existed'],
  409: ['The request conflicts with the resource’s current state (e.g. a duplicate)'],
  422: ['The payload is well-formed but semantically invalid'],
  429: ['Rate limiting kicked in — too many requests in this window'],
  500: ['An unhandled exception on the server', 'A downstream dependency (database, cache) timed out', 'Bad deploy or config change'],
  502: ['The upstream service is down or unreachable', 'A reverse proxy misconfiguration'],
  503: ['The service is overloaded or in maintenance', 'Rate limiting kicked in'],
  504: ['The upstream service took too long to respond'],
}

const NETWORK_CAUSES = [
  'The URL is unreachable or the host does not exist',
  'A firewall, VPN, or proxy is blocking the connection',
  'The server is not accepting connections on that port',
]

export interface FailureDiagnosis {
  isNetworkError: boolean
  title: string
  causes: string[]
  warnings: string[]
}

const SLOW_THRESHOLD_MS = 1000
const LARGE_BODY_BYTES = 1_000_000

/** Heuristic, non-fatal observations — surfaced even on a 2xx response. */
function warningsFor(response: ResponseModel, url: string): string[] {
  const warnings: string[] = []
  if (response.timeMs > SLOW_THRESHOLD_MS) {
    warnings.push(`Response took ${(response.timeMs / 1000).toFixed(1)}s — slower than the ${SLOW_THRESHOLD_MS}ms threshold`)
  }
  if (response.size > LARGE_BODY_BYTES) {
    warnings.push(`Body is ${(response.size / 1_000_000).toFixed(1)}MB — consider pagination or compression`)
  }
  if (url.startsWith('http://') && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
    warnings.push('Request was sent over plain HTTP, not HTTPS')
  }
  const contentType = response.headers['content-type'] ?? response.headers['Content-Type']
  if (response.bodyText.trim().startsWith('{') && !contentType?.includes('json')) {
    warnings.push('Body looks like JSON but the Content-Type header doesn’t say so')
  }
  if (response.redirects.length > 2) {
    warnings.push(`${response.redirects.length} redirects followed — a long chain adds latency`)
  }
  return warnings
}

export function diagnoseFailure(response: ResponseModel, url: string): FailureDiagnosis {
  const isNetworkError = Boolean(response.error)
  const isFailure = isNetworkError || response.status >= 400
  const title = isNetworkError
    ? `Request failed — ${response.error!.code}`
    : isFailure
      ? `Request failed — ${response.status} ${response.statusText}`
      : `${response.status} ${response.statusText}`
  const causes = isNetworkError
    ? NETWORK_CAUSES
    : isFailure
      ? (CAUSES_BY_STATUS[response.status] ?? ['An unexpected error response'])
      : []
  return { isNetworkError, title, causes, warnings: warningsFor(response, url) }
}
