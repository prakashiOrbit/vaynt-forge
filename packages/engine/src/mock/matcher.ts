import type { MockEndpoint } from '../types/mock'

/**
 * Sprint 10 — matches an incoming (method, path) against a mock server's
 * configured endpoints. Paths use Express-style `:param` segments (the same
 * shape `planMockEndpointsFromSpec` produces from an OpenAPI spec), matched
 * segment-by-segment so `/users/:id` matches `/users/usr_1` but not
 * `/users/usr_1/orders`. First configured endpoint that matches wins.
 */
export function matchMockEndpoint(
  endpoints: MockEndpoint[],
  method: string,
  path: string
): MockEndpoint | undefined {
  const requestSegments = splitPath(path)
  return endpoints.find((ep) => {
    if (ep.method.toUpperCase() !== method.toUpperCase()) return false
    const epSegments = splitPath(ep.path)
    if (epSegments.length !== requestSegments.length) return false
    return epSegments.every((seg, i) => seg.startsWith(':') || seg === requestSegments[i])
  })
}

function splitPath(path: string): string[] {
  const [withoutQuery] = path.split('?')
  return (withoutQuery ?? '').split('/').filter(Boolean)
}
