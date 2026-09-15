import type { HttpMethod, KeyValuePair, RequestBody } from '../types/request'

/**
 * Sprint 12 — parses a single `curl` command line into request fields.
 * Deliberately narrow (the flags real-world curl commands actually use for
 * API calls): `-X/--request`, `-H/--header`, `-d/--data*`, `-u/--user`,
 * `--url`, and a bare trailing URL. Not a shell parser — quoting is handled
 * with a small tokenizer, not a full POSIX grammar.
 */
export interface CurlParseResult {
  method: HttpMethod
  url: string
  headers: KeyValuePair[]
  body: RequestBody
  basicAuth?: { username: string; password: string }
}

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

function tokenize(command: string): string[] {
  const tokens: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]!
    if (quote) {
      if (ch === quote) {
        quote = null
      } else if (ch === '\\' && quote === '"' && i + 1 < command.length) {
        current += command[++i]
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"' || ch === "'") {
      quote = ch
      continue
    }
    if (ch === '\\' && command[i + 1] === '\n') {
      i++ // line continuation
      continue
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += ch
  }
  if (current) tokens.push(current)
  return tokens
}

export function parseCurlCommand(command: string): CurlParseResult {
  const tokens = tokenize(command.trim()).filter((t) => t !== 'curl')
  let method: HttpMethod | undefined
  let url: string | undefined
  const headers: KeyValuePair[] = []
  let rawBody: string | undefined
  let basicAuth: { username: string; password: string } | undefined

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!
    const next = () => tokens[++i]

    if (tok === '-X' || tok === '--request') {
      const m = (next() ?? '').toUpperCase()
      if (HTTP_METHODS.has(m as HttpMethod)) method = m as HttpMethod
    } else if (tok === '-H' || tok === '--header') {
      const header = next() ?? ''
      const idx = header.indexOf(':')
      if (idx > -1) {
        headers.push({ id: crypto.randomUUID(), key: header.slice(0, idx).trim(), value: header.slice(idx + 1).trim(), enabled: true })
      }
    } else if (tok === '-d' || tok === '--data' || tok === '--data-raw' || tok === '--data-binary') {
      rawBody = next() ?? ''
    } else if (tok === '-u' || tok === '--user') {
      const cred = next() ?? ''
      const idx = cred.indexOf(':')
      basicAuth = idx > -1 ? { username: cred.slice(0, idx), password: cred.slice(idx + 1) } : { username: cred, password: '' }
    } else if (tok === '--url') {
      url = next()
    } else if (!tok.startsWith('-') && !url) {
      url = tok
    }
  }

  if (!url) throw new Error('Could not find a URL in this curl command')

  const contentType = headers.find((h) => h.key.toLowerCase() === 'content-type')?.value ?? ''
  const body: RequestBody = rawBody
    ? { type: 'raw', language: contentType.includes('json') ? 'json' : contentType.includes('xml') ? 'xml' : 'text', content: rawBody }
    : { type: 'none' }

  return {
    method: method ?? (rawBody ? 'POST' : 'GET'),
    url,
    headers,
    body,
    basicAuth,
  }
}
