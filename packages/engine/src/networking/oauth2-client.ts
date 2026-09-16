import { request as undiciRequest } from 'undici'
import type { OAuth2Config } from '../types/request.js'

export interface OAuth2TokenResult {
  accessToken?: string
  tokenType?: string
  /** Ms-epoch, computed from the response's `expires_in` (seconds). Undefined if the server didn't return one — some client-credentials tokens don't expire. */
  expiresAt?: number
  scope?: string
  error?: string
}

/**
 * Real RFC 6749 §4.4 client-credentials grant: POSTs to `config.tokenUrl`
 * and parses a genuine token response — no canned token, no simulated
 * delay. Node/undici-only (like `http-client.ts`), so this runs in the
 * Electron main process, not the renderer.
 *
 * Sends the client credentials both ways real token endpoints expect them:
 * RFC 6749 §2.3.1 recommends HTTP Basic auth for a confidential client, but
 * plenty of real-world servers (tutorials and IdPs alike) instead check
 * `client_id`/`client_secret` as body params — sending both is harmless to
 * a server that only reads one, and saves the UI a "where do my credentials
 * go" toggle for a case most users won't know the answer to anyway.
 */
export async function fetchClientCredentialsToken(config: OAuth2Config): Promise<OAuth2TokenResult> {
  if (!config.tokenUrl.trim()) return { error: 'Token URL is required.' }
  if (!config.clientId.trim() || !config.clientSecret.trim()) {
    return { error: 'Client ID and Client Secret are required.' }
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
  if (config.scopes.trim()) body.set('scope', config.scopes.trim())
  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)
  const basicAuth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')

  let statusCode: number
  let text: string
  try {
    const res = await undiciRequest(config.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Basic ${basicAuth}`,
        accept: 'application/json',
      },
      body: body.toString(),
      headersTimeout: 15000,
      bodyTimeout: 15000,
    })
    statusCode = res.statusCode
    text = await res.body.text()
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) }
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return {
      error:
        statusCode >= 200 && statusCode < 300
          ? `Token endpoint returned a 2xx with a non-JSON body: ${text.slice(0, 200)}`
          : `Token request failed with status ${statusCode}: ${text.slice(0, 200)}`,
    }
  }

  if (statusCode < 200 || statusCode >= 300) {
    // RFC 6749 §5.2 error response shape.
    const err = json as { error?: string; error_description?: string }
    return { error: err.error_description || err.error || `Token request failed with status ${statusCode}` }
  }

  const payload = json as { access_token?: string; token_type?: string; expires_in?: number; scope?: string }
  if (!payload.access_token) return { error: 'Token endpoint response had no access_token field.' }
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    expiresAt: typeof payload.expires_in === 'number' ? Date.now() + payload.expires_in * 1000 : undefined,
    scope: payload.scope,
  }
}
