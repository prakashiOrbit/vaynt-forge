import type { AuthConfig, KeyValuePair } from '../types/request.js'
import type { ResolutionContext } from '../types/variables.js'
import { resolveVariables } from '../variables/resolver.js'

function pair(key: string, value: string): KeyValuePair {
  return { id: `auth_${key}`, key, value, enabled: true }
}

/**
 * Derives the extra headers/query params an {@link AuthConfig} contributes.
 * Pure — returns new arrays, never mutates the request's own params/headers.
 * `custom` and unresolved OAuth2 flows are intentionally not auto-applied;
 * those are documented as pre-request-script territory (see AuthorizationPanel).
 *
 * Every field is resolved against `ctx` before use — found by actually
 * sending a real request with `{{authToken}}` typed into the Bearer Token
 * field (the obvious, expected way to keep a secret out of the request
 * itself) and discovering the literal, unresolved string went out over the
 * wire as `Authorization: Bearer {{authToken}}` instead. Every other value
 * in the app (URL, params, headers, body) already resolved `{{variables}}`;
 * auth fields were the one place that silently didn't.
 */
export function applyAuth(
  auth: AuthConfig,
  ctx: ResolutionContext
): { headers: KeyValuePair[]; params: KeyValuePair[] } {
  const resolve = (template: string): string => resolveVariables(template, ctx).value
  switch (auth.type) {
    case 'none':
    case 'custom':
      return { headers: [], params: [] }
    case 'inherit':
      // Resolved renderer-side (see resolveEffectiveAuth in
      // collections/inheritance.ts) before a request ever reaches a real
      // network call — a literal 'inherit' reaching here means nothing
      // resolved it (e.g. Compare/Debugger, which don't wire collection
      // context through), so it safely contributes nothing, same as 'none'.
      return { headers: [], params: [] }
    case 'apiKey': {
      const key = resolve(auth.key)
      const value = resolve(auth.value)
      return auth.location === 'query'
        ? { headers: [], params: [pair(key, value)] }
        : { headers: [pair(key, value)], params: [] }
    }
    case 'bearer':
      return { headers: [pair('Authorization', `Bearer ${resolve(auth.token)}`)], params: [] }
    case 'jwt':
      return { headers: [pair('Authorization', `Bearer ${resolve(auth.token)}`)], params: [] }
    case 'basic': {
      // `btoa` is a global in both the renderer (browser) and Node 18+ (main
      // process) — no need for a Buffer fallback, which would pull a
      // Node-only type into this Electron-free, renderer-visible package.
      const encoded = btoa(`${resolve(auth.username)}:${resolve(auth.password)}`)
      return { headers: [pair('Authorization', `Basic ${encoded}`)], params: [] }
    }
    case 'oauth2':
      return auth.accessToken
        ? { headers: [pair('Authorization', `Bearer ${resolve(auth.accessToken)}`)], params: [] }
        : { headers: [], params: [] }
    case 'aws':
    case 'digest':
    case 'oauth1':
      // All three need `node:crypto` (HMAC/SHA) and, for digest, a real 401
      // challenge round-trip — neither fits this renderer-visible, Node-free
      // module. Real signing happens in the Node-only http-client.ts (see
      // buildSigV4Headers/buildDigestHeader/buildOAuth1Header), which calls
      // this function first, sees nothing to contribute here, and adds the
      // real Authorization header itself.
      return { headers: [], params: [] }
  }
}
