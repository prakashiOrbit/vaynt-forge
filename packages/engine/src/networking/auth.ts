import type { AuthConfig, KeyValuePair } from '../types/request'

function pair(key: string, value: string): KeyValuePair {
  return { id: `auth_${key}`, key, value, enabled: true }
}

/**
 * Derives the extra headers/query params an {@link AuthConfig} contributes.
 * Pure — returns new arrays, never mutates the request's own params/headers.
 * `custom` and unresolved OAuth2 flows are intentionally not auto-applied;
 * those are documented as pre-request-script territory (see AuthorizationPanel).
 */
export function applyAuth(auth: AuthConfig): { headers: KeyValuePair[]; params: KeyValuePair[] } {
  switch (auth.type) {
    case 'none':
    case 'custom':
      return { headers: [], params: [] }
    case 'apiKey':
      return auth.location === 'query'
        ? { headers: [], params: [pair(auth.key, auth.value)] }
        : { headers: [pair(auth.key, auth.value)], params: [] }
    case 'bearer':
      return { headers: [pair('Authorization', `Bearer ${auth.token}`)], params: [] }
    case 'jwt':
      return { headers: [pair('Authorization', `Bearer ${auth.token}`)], params: [] }
    case 'basic': {
      // `btoa` is a global in both the renderer (browser) and Node 18+ (main
      // process) — no need for a Buffer fallback, which would pull a
      // Node-only type into this Electron-free, renderer-visible package.
      const encoded = btoa(`${auth.username}:${auth.password}`)
      return { headers: [pair('Authorization', `Basic ${encoded}`)], params: [] }
    }
    case 'oauth2':
      return auth.accessToken
        ? { headers: [pair('Authorization', `Bearer ${auth.accessToken}`)], params: [] }
        : { headers: [], params: [] }
    case 'aws':
      // SigV4 request signing is not implemented — a real AWS-signed request
      // needs canonical request construction we're not taking on here.
      return { headers: [], params: [] }
  }
}
