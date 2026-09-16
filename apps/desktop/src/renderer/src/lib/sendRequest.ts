import type { Collection, Environment, Folder, RequestModel, ResponseModel, ScriptContext, ScriptResult, Variable } from '@vayntforge/engine'
import {
  resolveAncestorChain,
  resolveAncestorScripts,
  resolveCollectionVariables,
  resolveEffectiveAuth,
} from '@vayntforge/engine'

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

/**
 * Runs several script sources in sequence (e.g. collection → folder →
 * request), threading each one's `pm.environment.set` patch into the next's
 * `pm.environment.get` snapshot, and merges everything into the single
 * `ScriptResult` shape the rest of the app already expects — stops (with
 * whatever ran so far) on the first error, same as a real script chain
 * would. Blank sources are skipped; an all-blank chain runs nothing.
 */
async function runScriptChain(
  scripts: string[],
  baseEnvSnapshot: Record<string, string>,
  buildContext: (environment: Record<string, string>) => ScriptContext
): Promise<ScriptResult | undefined> {
  const nonBlank = scripts.filter((s) => s.trim())
  if (nonBlank.length === 0) return undefined
  let patch: Record<string, string> = {}
  let logs: string[] = []
  let visualizer: ScriptResult['visualizer']
  for (const code of nonBlank) {
    const result = await window.vayntforge.scripts.run(code, buildContext({ ...baseEnvSnapshot, ...patch }))
    logs = [...logs, ...result.logs]
    patch = { ...patch, ...result.environmentPatch }
    if (result.visualizer) visualizer = result.visualizer
    if (result.error) return { logs, environmentPatch: patch, visualizer, error: result.error, timedOut: result.timedOut }
  }
  return { logs, environmentPatch: patch, visualizer }
}

export interface SendResult {
  response: ResponseModel
  preScript?: ScriptResult
  postScript?: ScriptResult
}

/**
 * Runs the full send pipeline: ancestor + own pre-request scripts →
 * variable resolution → real network execution (via `UndiciRequestClient`
 * over `network:execute` IPC — genuine DNS/TLS/HTTP, not a simulation) →
 * ancestor + own post-response scripts. Script environment patches only
 * affect variable resolution for *this* send — they are not persisted back
 * to the real environment (that would be a bigger feature: deciding which
 * scope to write to, confirming overwrites, etc.).
 *
 * `extraVariables` is Sprint 7's hook for the Collection Runner: chain-rule
 * extractions from earlier requests in the same run, and the current data-file
 * row (if any). They resolve at request scope — the highest priority — same
 * as the request's own `variables`, so a chain value can override a request
 * variable of the same name for this run without mutating the saved request.
 *
 * `collections`/`foldersByCollection` resolve the draft's inheritance chain
 * (its own auth if set to `{type:'inherit'}`, the collection's variables,
 * and any collection/folder scripts, run collection → folder → request
 * ahead of the draft's own). Omit them (both default to empty) for a
 * request with no collection context to resolve — e.g. Compare/Debugger —
 * in which case `{type:'inherit'}` safely falls back to no auth, same as
 * `applyAuth`'s own fallback for an unresolved `'inherit'`.
 */
export async function sendRequest(
  draft: RequestModel,
  globalVariables: Variable[],
  environment: Environment | undefined,
  extraVariables: KV[] = [],
  collections: Collection[] = [],
  foldersByCollection: Record<string, Folder[]> = {},
  temporaryVariables: Variable[] = []
): Promise<SendResult> {
  const chain = resolveAncestorChain(draft, collections, foldersByCollection)
  const effectiveAuth = resolveEffectiveAuth(draft.auth, chain)
  const requestToSend = effectiveAuth === draft.auth ? draft : { ...draft, auth: effectiveAuth }
  const collectionVars = resolveCollectionVariables(chain)
  const ancestorScripts = resolveAncestorScripts(chain)

  const baseEnvVars = environment?.variables ?? []
  const requestScope = [...draft.variables, ...extraVariables]
  const temporaryScope = toKV(temporaryVariables)
  const envSnapshot = envRecord(toKV(globalVariables), collectionVars, toKV(baseEnvVars), requestScope)
  const requestContext = { method: draft.method, url: draft.url, headers: headerRecord(draft) }

  const preScript = await runScriptChain(
    [...ancestorScripts.preRequest, draft.scripts.preRequest],
    envSnapshot,
    (environment) => ({ request: requestContext, environment })
  )

  const effectiveEnvVars = withPatch(baseEnvVars, preScript?.environmentPatch)
  const response = await window.vayntforge.network.execute(requestToSend, {
    global: toKV(globalVariables),
    collection: collectionVars,
    environment: toKV(effectiveEnvVars),
    request: requestScope,
    temporary: temporaryScope,
  })

  const postScript = await runScriptChain(
    [...ancestorScripts.postResponse, draft.scripts.postResponse],
    { ...envSnapshot, ...preScript?.environmentPatch },
    (environment) => ({
      request: requestContext,
      response: {
        status: response.status,
        headers: response.headers,
        body: response.body,
        bodyText: response.bodyText,
        timeMs: response.timeMs,
      },
      environment,
    })
  )

  return { response, preScript, postScript }
}
