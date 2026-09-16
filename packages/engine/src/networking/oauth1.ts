import { createHmac, randomBytes } from 'node:crypto'

/** RFC 3986 percent-encoding — stricter than `encodeURIComponent` (also escapes `! * ' ( )`), as OAuth 1.0a's signature base string requires. */
function percentEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function normalizedPort(url: URL): string {
  if (!url.port) return ''
  const isDefault = (url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443')
  return isDefault ? '' : `:${url.port}`
}

export interface OAuth1SignInput {
  method: string
  /** Full resolved request URL (query params already applied, before any oauth_* params). */
  url: string
  consumerKey: string
  consumerSecret: string
  token?: string
  tokenSecret?: string
  signatureMethod: 'HMAC-SHA1' | 'PLAINTEXT'
  /**
   * Body params to fold into the signature base string — RFC 5849 §3.4.1.3
   * includes these only for an `application/x-www-form-urlencoded` body.
   */
  bodyParams?: [string, string][]
}

/** Builds a real `Authorization: OAuth ...` header per RFC 5849 (HMAC-SHA1 or PLAINTEXT). */
export function buildOAuth1Header(input: OAuth1SignInput): string {
  const url = new URL(input.url)
  const baseUri = `${url.protocol}//${url.hostname.toLowerCase()}${normalizedPort(url)}${url.pathname}`

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: input.consumerKey,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: input.signatureMethod,
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_version: '1.0',
  }
  if (input.token) oauthParams.oauth_token = input.token

  const allParams: [string, string][] = [
    ...Object.entries(oauthParams),
    ...url.searchParams.entries(),
    ...(input.bodyParams ?? []),
  ]

  const normalized = allParams
    .map(([k, v]) => [percentEncode(k), percentEncode(v)] as [string, string])
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const baseString = `${input.method.toUpperCase()}&${percentEncode(baseUri)}&${percentEncode(normalized)}`
  const signingKey = `${percentEncode(input.consumerSecret)}&${percentEncode(input.tokenSecret ?? '')}`

  const signature =
    input.signatureMethod === 'PLAINTEXT' ? signingKey : createHmac('sha1', signingKey).update(baseString).digest('base64')

  oauthParams.oauth_signature = signature

  const headerParams = Object.entries(oauthParams)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${percentEncode(k)}="${percentEncode(v)}"`)
    .join(', ')

  return `OAuth ${headerParams}`
}
