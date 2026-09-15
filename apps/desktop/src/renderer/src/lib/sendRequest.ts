import { MockRequestClient, collectVariables } from '@vayntforge/engine'
import type { Environment, RequestModel, ResponseModel, ScriptResult, Variable } from '@vayntforge/engine'

export type KV = { key: string; value: string }

function toKV(list: Variable[]): KV[] {
  return list.map((v) => ({ key: v.key, value: v.currentValue }))
}

function envRecord(...lists: KV[][]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const list of lists) for (const v of list) out[v.key] = v.value
  return out
}

/** Applies `pm.environment.set` patches on top of a base variable list (highest priority). */
function withPatch(base: Variable[], patch: Record<string, string> | undefined): Variable[] {
  if (!patch || Object.keys(patch).length === 0) return base
  const overridden = new Set(Object.keys(patch))
  const kept = base.filter((v) => !overridden.has(v.key))
  const added = Object.entries(patch).map(([key, value]) => ({
    id: `patch_${key}`,
    key,
    initialValue: value,
    currentValue: value,
    scope: 'environment' as const,
    secret: false,
  }))
  return [...kept, ...added]
}

function headerRecord(request: RequestModel): Record<string, string> {
  const out: Record<string, string> = {}
  for (const h of request.headers) if (h.enabled) out[h.key] = h.value
  return out
}

export interface SendResult {
  response: ResponseModel
  preScript?: ScriptResult
  postScript?: ScriptResult
}

/**
 * Runs the full Sprint 6 send pipeline: pre-request script → variable
 * resolution → (mocked) execution → post-response script. Script environment
 * patches only affect variable resolution for *this* send — they are not
 * persisted back to the real environment (that would be a bigger feature:
 * deciding which scope to write to, confirming overwrites, etc.).
 *
 * `extraVariables` is Sprint 7's hook for the Collection Runner: chain-rule
 * extractions from earlier requests in the same run, and the current data-file
 * row (if any). They resolve at request scope — the highest priority — same
 * as the request's own `variables`, so a chain value can override a request
 * variable of the same name for this run without mutating the saved request.
 */
export async function sendRequest(
  draft: RequestModel,
  globalVariables: Variable[],
  environment: Environment | undefined,
  extraVariables: KV[] = []
): Promise<SendResult> {
  const baseEnvVars = environment?.variables ?? []
  const requestScope = [...draft.variables, ...extraVariables]
  const envSnapshot = envRecord(toKV(globalVariables), toKV(baseEnvVars), requestScope)

  let preScript: ScriptResult | undefined
  if (draft.scripts.preRequest.trim()) {
    preScript = await window.vayntforge.scripts.run(draft.scripts.preRequest, {
      request: { method: draft.method, url: draft.url, headers: headerRecord(draft) },
      environment: envSnapshot,
    })
  }

  const effectiveEnvVars = withPatch(baseEnvVars, preScript?.environmentPatch)
  const ctx = {
    variables: collectVariables({
      global: toKV(globalVariables),
      environment: toKV(effectiveEnvVars),
      request: requestScope,
    }),
  }
  const response = await new MockRequestClient().execute(draft, ctx)

  let postScript: ScriptResult | undefined
  if (draft.scripts.postResponse.trim()) {
    postScript = await window.vayntforge.scripts.run(draft.scripts.postResponse, {
      request: { method: draft.method, url: draft.url, headers: headerRecord(draft) },
      response: {
        status: response.status,
        headers: response.headers,
        body: response.body,
        bodyText: response.bodyText,
        timeMs: response.timeMs,
      },
      environment: { ...envSnapshot, ...preScript?.environmentPatch },
    })
  }

  return { response, preScript, postScript }
}
