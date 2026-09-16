import type { Environment } from '@vayntforge/engine'

/**
 * Merges a `pm.environment.set()` patch (pre-request and/or post-response —
 * callers pass both merged, post taking priority) into a real `Environment`:
 * updates an existing variable's `currentValue` in place, or creates a new
 * one (scope `environment`, never flagged secret — a fresh key from a
 * script has no signal either way, and defaulting to secret would hide it
 * from the very script that just set it). Until now this patch only ever
 * affected the resolution of the one send that produced it — the entire
 * point of `pm.environment.set()` (an auth-refresh flow, an extracted
 * token) is that a *later* send sees it too, which needs this to actually
 * persist.
 *
 * Returns `undefined` when there's nothing to persist (no active
 * environment, or an empty patch) — callers should treat that as "no save
 * needed" rather than "save an unchanged environment."
 */
export function applyEnvironmentPatch(
  environment: Environment | undefined,
  patch: Record<string, string> | undefined
): Environment | undefined {
  if (!environment || !patch) return undefined
  const entries = Object.entries(patch)
  if (entries.length === 0) return undefined

  const byKey = new Map(environment.variables.map((v) => [v.key, v]))
  for (const [key, value] of entries) {
    const existing = byKey.get(key)
    byKey.set(
      key,
      existing
        ? { ...existing, currentValue: value }
        : { id: crypto.randomUUID(), key, initialValue: value, currentValue: value, scope: 'environment', secret: false }
    )
  }
  return { ...environment, variables: [...byKey.values()], updatedAt: Date.now() }
}
