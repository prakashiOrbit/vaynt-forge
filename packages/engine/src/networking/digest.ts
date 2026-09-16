import { createHash, randomBytes } from 'node:crypto'

/** A parsed `WWW-Authenticate: Digest ...` challenge (RFC 2617/7616). */
export interface DigestChallenge {
  realm: string
  nonce: string
  /** Raw `qop` value from the challenge, e.g. `"auth"` or `"auth,auth-int"`. */
  qop?: string
  opaque?: string
  algorithm?: string
}

/** Parses a `WWW-Authenticate` header; returns `undefined` if it isn't a Digest challenge (or lacks the fields a response needs). */
export function parseDigestChallenge(header: string | undefined): DigestChallenge | undefined {
  if (!header || !/^\s*Digest\s/i.test(header)) return undefined
  const rest = header.trim().replace(/^Digest\s+/i, '')
  const params: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|([^,]*))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest))) {
    const key = m[1]
    const value = m[2] !== undefined ? m[2] : (m[3] ?? '').trim()
    if (key) params[key] = value
  }
  if (!params.realm || !params.nonce) return undefined
  return { realm: params.realm, nonce: params.nonce, qop: params.qop, opaque: params.opaque, algorithm: params.algorithm }
}

const md5 = (s: string): string => createHash('md5').update(s, 'utf8').digest('hex')

export interface DigestSignInput {
  username: string
  password: string
  method: string
  /** Request-URI as sent on the wire — path + query, not the full absolute URL. */
  uri: string
  /** Entity body, needed only for `qop=auth-int`. */
  body?: string
  challenge: DigestChallenge
}

/** Builds a real `Authorization: Digest ...` response header (MD5/MD5-sess, qop=auth/auth-int, or legacy no-qop). */
export function buildDigestHeader(input: DigestSignInput): string {
  const { username, password, method, uri, challenge, body } = input
  const { realm, nonce, opaque } = challenge
  const algorithm = challenge.algorithm?.toUpperCase()
  const qop = challenge.qop
    ?.split(',')
    .map((s) => s.trim())
    .find((q) => q === 'auth' || q === 'auth-int')

  const cnonce = randomBytes(8).toString('hex')
  const nc = '00000001'

  let ha1 = md5(`${username}:${realm}:${password}`)
  if (algorithm === 'MD5-SESS') {
    ha1 = md5(`${ha1}:${nonce}:${cnonce}`)
  }

  const ha2 = qop === 'auth-int' ? md5(`${method}:${uri}:${md5(body ?? '')}`) : md5(`${method}:${uri}`)

  const response = qop ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${nonce}:${ha2}`)

  const parts = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (challenge.algorithm) parts.push(`algorithm=${challenge.algorithm}`)
  if (qop) parts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  if (opaque) parts.push(`opaque="${opaque}"`)

  return `Digest ${parts.join(', ')}`
}
