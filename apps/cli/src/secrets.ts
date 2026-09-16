import { readFileSync } from 'node:fs'
import type { Variable } from '@vayntforge/engine'

/**
 * Only global and environment variables ever pass through the desktop app's
 * `safeStorage` codec (`withSecretCodec` in `@vayntforge/engine`) — collection
 * variables and request auth fields are stored plaintext regardless of the
 * `secret` toggle today (a separate, real gap in the app itself, not
 * introduced here). For the two scopes that ARE codec-protected, this CLI
 * has no way to tell a real OS-keychain ciphertext blob apart from plaintext
 * written on a platform where the keychain was unavailable — both are just
 * strings in the same SQLite column. Rather than guess, every `secret: true`
 * global/environment variable is treated as unusable unless explicitly
 * overridden via `--env-var`/`--secrets`, matching how a real CI pipeline
 * would supply secrets anyway (repo/CI environment variables, not a
 * decrypted local vault).
 */
export function applySecretOverrides(variables: Variable[], overrides: Record<string, string>, warn: (message: string) => void): Variable[] {
  return variables.map((v) => {
    if (!v.secret) return v
    const override = overrides[v.key]
    if (override !== undefined) return { ...v, currentValue: override, initialValue: override }
    warn(`secret variable "${v.key}" has no --env-var/--secrets override — sending it as an empty string`)
    return { ...v, currentValue: '', initialValue: '' }
  })
}

/** Parses repeated `--env-var KEY=VALUE` flags into a flat override map. */
export function parseEnvVarFlags(values: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const raw of values) {
    const eq = raw.indexOf('=')
    if (eq === -1) throw new Error(`--env-var expects KEY=VALUE, got "${raw}"`)
    out[raw.slice(0, eq)] = raw.slice(eq + 1)
  }
  return out
}

/** Reads a flat `{ "KEY": "value" }` JSON file of secret overrides. */
export function loadSecretsFile(path: string): Record<string, string> {
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--secrets file must be a flat JSON object of KEY: "value" pairs (${path})`)
  }
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== 'string') throw new Error(`--secrets file value for "${key}" must be a string (${path})`)
    out[key] = value
  }
  return out
}
