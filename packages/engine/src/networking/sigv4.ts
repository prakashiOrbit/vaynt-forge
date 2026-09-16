import { createHash, createHmac } from 'node:crypto'

const ALGORITHM = 'AWS4-HMAC-SHA256'

function sha256Hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

/** RFC 3986 percent-encoding, preserving `/` — matches AWS's canonical-URI escaping rules. */
function encodePath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`))
    .join('/')
}

function encodeQueryComponent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
}

function canonicalQueryString(url: URL): string {
  const params: [string, string][] = [...url.searchParams.entries()]
  return params
    .map(([k, v]) => [encodeQueryComponent(k), encodeQueryComponent(v)] as [string, string])
    .sort(([ak, av], [bk, bv]) => (ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
}

export interface SigV4SignInput {
  method: string
  url: string
  /** Existing request headers (host is derived from the URL if not already present). */
  headers: Record<string, string>
  body?: string
  accessKey: string
  secretKey: string
  sessionToken?: string
  region: string
  service: string
  /** For deterministic tests — defaults to `new Date()`. */
  now?: Date
}

function amzDate(now: Date): { full: string; dateStamp: string } {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { full: iso, dateStamp: iso.slice(0, 8) }
}

/**
 * Builds real AWS Signature Version 4 headers (`Authorization`, `X-Amz-Date`,
 * `X-Amz-Content-Sha256`, and `X-Amz-Security-Token` for temporary STS
 * credentials) per AWS's canonical-request/string-to-sign/signing-key spec.
 * Computed once, pre-send — no challenge round trip needed (unlike Digest).
 */
export function buildSigV4Headers(input: SigV4SignInput): Record<string, string> {
  const url = new URL(input.url)
  const { full: amzDateFull, dateStamp } = amzDate(input.now ?? new Date())
  const payloadHash = sha256Hex(input.body ?? '')

  const headerEntries: [string, string][] = Object.entries(input.headers).map(([k, v]) => [k.toLowerCase(), v.trim()])
  const withRequired = new Map(headerEntries)
  withRequired.set('host', url.host)
  withRequired.set('x-amz-date', amzDateFull)
  withRequired.set('x-amz-content-sha256', payloadHash)
  if (input.sessionToken) withRequired.set('x-amz-security-token', input.sessionToken)

  const sortedHeaderNames = [...withRequired.keys()].sort()
  const canonicalHeaders = sortedHeaderNames.map((name) => `${name}:${withRequired.get(name)}\n`).join('')
  const signedHeaders = sortedHeaderNames.join(';')

  const canonicalRequest = [
    input.method.toUpperCase(),
    encodePath(url.pathname || '/'),
    canonicalQueryString(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`
  const stringToSign = [ALGORITHM, amzDateFull, credentialScope, sha256Hex(canonicalRequest)].join('\n')

  const kDate = hmac(`AWS4${input.secretKey}`, dateStamp)
  const kRegion = hmac(kDate, input.region)
  const kService = hmac(kRegion, input.service)
  const kSigning = hmac(kService, 'aws4_request')
  const signature = hmac(kSigning, stringToSign).toString('hex')

  const authorization = `${ALGORITHM} Credential=${input.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const result: Record<string, string> = {
    Authorization: authorization,
    'X-Amz-Date': amzDateFull,
    'X-Amz-Content-Sha256': payloadHash,
  }
  if (input.sessionToken) result['X-Amz-Security-Token'] = input.sessionToken
  return result
}
