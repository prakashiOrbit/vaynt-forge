import type { ResolutionContext, ResolutionResult } from '../types/variables'

const VARIABLE_PATTERN = /\{\{\s*([^{}\s]+)\s*\}\}/g

const GUID_PATTERN = /\{\{\s*\$guid\s*\}\}/gi
const TIMESTAMP_PATTERN = /\{\{\s*\$timestamp\s*\}\}/gi
const RANDOM_INT_PATTERN = /\{\{\s*\$randomInt\s*(?:\(\s*(\d+)\s*,\s*(\d+)\s*\))?\s*\}\}/gi

function generateGuid(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex
    .slice(8, 10)
    .join('')}-${hex.slice(10).join('')}`
}

/**
 * Resolve `{{variable}}` references and generated macros in a template string.
 *
 * Lookup priority: temporary → request → collection → environment → global.
 */
export function resolveVariables(template: string, ctx: ResolutionContext): ResolutionResult {
  const resolvedKeys = new Set<string>()
  const missingKeys = new Set<string>()

  const substitute = (match: string, rawKey: string): string => {
    const key = rawKey.trim()
    const lower = key.toLowerCase()
    if (lower === '$guid') return generateGuid()
    if (lower === '$timestamp') return String(Math.floor(Date.now() / 1000))
    if (/^RandomInt/.test(rawKey) || lower === '$randomint') {
      return generateRandomInt(rawKey)
    }
    const value = lookupValue(key, ctx)
    if (value === undefined) {
      missingKeys.add(key)
      return match
    }
    resolvedKeys.add(key)
    return value
  }

  let value = template.replace(VARIABLE_PATTERN, substitute)
  value = value.replace(GUID_PATTERN, () => generateGuid())
  value = value.replace(TIMESTAMP_PATTERN, () => String(Math.floor(Date.now() / 1000)))
  value = value.replace(RANDOM_INT_PATTERN, (_m, minRaw?: string, maxRaw?: string) => {
    const min = minRaw ? Number(minRaw) : 0
    const max = maxRaw ? Number(maxRaw) : 1000
    return String(min + Math.floor(Math.random() * (max - min + 1)))
  })

  return { value, resolvedKeys, missingKeys }
}

function lookupValue(key: string, ctx: ResolutionContext): string | undefined {
  return (
    ctx.temporary.get(key) ??
    ctx.request.get(key) ??
    ctx.collection.get(key) ??
    ctx.environment.get(key) ??
    ctx.global.get(key)
  )
}

function generateRandomInt(raw: string): string {
  const m = /\((\d+)\s*,\s*(\d+)\)/.exec(raw)
  const min = m ? Number(m[1]) : 0
  const max = m ? Number(m[2]) : 1000
  return String(min + Math.floor(Math.random() * (max - min + 1)))
}

export function collectVariables(
  scopes: {
    global?: { key: string; value: string }[]
    environment?: { key: string; value: string }[]
    collection?: { key: string; value: string }[]
    request?: { key: string; value: string }[]
    temporary?: { key: string; value: string }[]
  }
): ResolutionContext {
  const toMap = (
    list?: { key: string; value: string }[]
  ): Map<string, string> => new Map((list ?? []).map((v) => [v.key, v.value]))
  return {
    global: toMap(scopes.global),
    environment: toMap(scopes.environment),
    collection: toMap(scopes.collection),
    request: toMap(scopes.request),
    temporary: toMap(scopes.temporary),
  }
}