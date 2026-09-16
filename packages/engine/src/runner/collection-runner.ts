import { UndiciRequestClient } from '../networking/http-client.js'
import { runScript } from '../scripting/sandbox.js'
import {
  resolveAncestorChain,
  resolveAncestorScripts,
  resolveCollectionVariables,
  resolveEffectiveAuth,
} from '../collections/inheritance.js'
import { collectVariables } from '../variables/resolver.js'
import { resolveRequest } from '../networking/resolve-request.js'
import { cookieHeaderForUrl, cookiesFromResponse, mergeIntoJar } from '../networking/cookie-jar.js'
import { evaluateAssertions, resolvePath } from '../testing/evaluate.js'
import type { ScriptContext, ScriptResult } from '../scripting/types.js'
import type { RequestModel } from '../types/request.js'
import type { Collection, Folder, ChainRule, RunStatus, TestRunRequestResult } from '../types/workspace.js'
import type { Environment, Variable } from '../types/variables.js'
import type { JarCookie, ResponseModel } from '../types/response.js'
import type { ClientCertificateEntry, ProxyConfig } from '../types/settings.js'

/**
 * The engine-side "send one request" pipeline: ancestor + own pre-request
 * scripts → variable resolution → real network execution (`UndiciRequestClient`
 * — genuine DNS/TLS/HTTP, the same client the desktop app's Send button and
 * `network:execute` IPC handler use) → cookie-jar update → ancestor + own
 * post-response scripts. This is the Node-only sibling of the renderer's
 * `sendRequest.ts` + the main process's `NETWORK_EXECUTE` IPC handler, merged
 * into one function — there's no renderer/main split to bridge here since
 * both the CLI and this module run directly in a plain Node process. Kept in
 * `packages/engine` (not `apps/desktop`) so both call sites can eventually
 * share it; today only the CLI runner (`apps/cli`) calls it.
 */

export type KV = { key: string; value: string }

function toKV(list: Variable[]): KV[] {
  return list.map((v) => ({ key: v.key, value: v.currentValue }))
}

function envRecord(...lists: KV[][]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const list of lists) for (const v of list) out[v.key] = v.value
  return out
}

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

/** Runs a script chain synchronously (`runScript` is sync — no IPC hop to await here), threading each script's environment patch into the next's snapshot. Stops on the first error. */
function runScriptChain(
  scripts: string[],
  baseEnvSnapshot: Record<string, string>,
  buildContext: (environment: Record<string, string>) => ScriptContext
): ScriptResult | undefined {
  const nonBlank = scripts.filter((s) => s.trim())
  if (nonBlank.length === 0) return undefined
  let patch: Record<string, string> = {}
  let logs: string[] = []
  let visualizer: ScriptResult['visualizer']
  for (const code of nonBlank) {
    const result = runScript(code, buildContext({ ...baseEnvSnapshot, ...patch }))
    logs = [...logs, ...result.logs]
    patch = { ...patch, ...result.environmentPatch }
    if (result.visualizer) visualizer = result.visualizer
    if (result.error) return { logs, environmentPatch: patch, visualizer, error: result.error, timedOut: result.timedOut }
  }
  return { logs, environmentPatch: patch, visualizer }
}

export interface NetworkExecutionOptions {
  proxy?: ProxyConfig
  caCertificates?: string[]
  clientCertificates?: ClientCertificateEntry[]
}

/**
 * Sends one real request end to end (scripts, variables, auth inheritance,
 * cookie jar) and returns the response plus the jar to carry into the next
 * request. `client` defaults to a fresh `UndiciRequestClient` per call — pass
 * a shared instance if you're sending many requests and want connection
 * reuse (the collection runner below does).
 */
export async function sendResolvedRequest(input: {
  request: RequestModel
  globalVariables: Variable[]
  environment?: Environment
  extraVariables?: KV[]
  collections?: Collection[]
  foldersByCollection?: Record<string, Folder[]>
  cookieJar: JarCookie[]
  network?: NetworkExecutionOptions
  client?: UndiciRequestClient
}): Promise<{ response: ResponseModel; cookieJar: JarCookie[]; preScript?: ScriptResult; postScript?: ScriptResult }> {
  const {
    request,
    globalVariables,
    environment,
    extraVariables = [],
    collections = [],
    foldersByCollection = {},
    network = {},
    client = new UndiciRequestClient(),
  } = input
  let jar = input.cookieJar

  const chain = resolveAncestorChain(request, collections, foldersByCollection)
  const effectiveAuth = resolveEffectiveAuth(request.auth, chain)
  const draft = effectiveAuth === request.auth ? request : { ...request, auth: effectiveAuth }
  const collectionVars = resolveCollectionVariables(chain)
  const ancestorScripts = resolveAncestorScripts(chain)

  const baseEnvVars = environment?.variables ?? []
  const requestScope = [...draft.variables, ...extraVariables]
  const envSnapshot = envRecord(toKV(globalVariables), collectionVars, toKV(baseEnvVars), requestScope)
  const requestContext = { method: draft.method, url: draft.url, headers: headerRecord(draft) }

  const preScript = runScriptChain(
    [...ancestorScripts.preRequest, draft.scripts.preRequest],
    envSnapshot,
    (environmentSnapshot) => ({ request: requestContext, environment: environmentSnapshot })
  )

  const effectiveEnvVars = withPatch(baseEnvVars, preScript?.environmentPatch)
  const scopes = {
    global: toKV(globalVariables),
    collection: collectionVars,
    environment: toKV(effectiveEnvVars),
    request: requestScope,
  }
  const variables = collectVariables(scopes)

  const hasExplicitCookieHeader = draft.headers.some((h) => h.enabled && h.key.toLowerCase() === 'cookie')
  let requestToSend = draft
  let resolvedUrl: string | undefined
  try {
    resolvedUrl = resolveRequest(draft, variables).url
  } catch {
    resolvedUrl = undefined
  }
  if (!hasExplicitCookieHeader && resolvedUrl) {
    const jarHeader = cookieHeaderForUrl(jar, resolvedUrl, Date.now())
    if (jarHeader) {
      requestToSend = { ...draft, headers: [...draft.headers, { id: '__cookie_jar__', key: 'Cookie', value: jarHeader, enabled: true }] }
    }
  }

  const response = await client.execute(requestToSend, { variables, ...network })

  if (resolvedUrl && response.cookies?.length) {
    const now = Date.now()
    const incoming = cookiesFromResponse(response.cookies, resolvedUrl, now)
    if (incoming.length > 0) jar = mergeIntoJar(jar, incoming, now)
  }

  const postScript = runScriptChain(
    [...ancestorScripts.postResponse, draft.scripts.postResponse],
    { ...envSnapshot, ...preScript?.environmentPatch },
    (environmentSnapshot) => ({
      request: requestContext,
      response: { status: response.status, headers: response.headers, body: response.body, bodyText: response.bodyText, timeMs: response.timeMs },
      environment: environmentSnapshot,
    })
  )

  return { response, cookieJar: jar, preScript, postScript }
}

export interface CollectionRunInput {
  /** The requests to run, in order — one pass over this list per iteration. */
  requests: RequestModel[]
  collections?: Collection[]
  foldersByCollection?: Record<string, Folder[]>
  globalVariables: Variable[]
  environment?: Environment
  iterations?: number
  delayMs?: number
  concurrency?: number
  /** One row per iteration; overrides `iterations` to `dataRows.length` when set. */
  dataRows?: Record<string, unknown>[]
  chainRules?: ChainRule[]
  network?: NetworkExecutionOptions
  cookieJar?: JarCookie[]
  /** Stop the whole run (no further iterations) after the first failed request. */
  bail?: boolean
}

export interface CollectionRunHooks {
  onResult?(result: TestRunRequestResult, iteration: number): void
}

export interface CollectionRunSummary {
  startedAt: number
  finishedAt: number
  iterations: number
  results: TestRunRequestResult[]
  passed: number
  failed: number
  skipped: number
  cookieJar: JarCookie[]
}

/**
 * The engine-side collection runner: iterations × requests, optional
 * concurrency (forced to 1 when a chain rule is enabled, since chaining is an
 * inherently sequential dependency — same rule the GUI Collection Runner
 * applies), optional CSV/JSON data-file rows, real request chaining (extract
 * a JSONPath from one response into a variable later requests can use), and
 * real assertion evaluation. Mirrors
 * `apps/desktop/.../components/collections/CollectionRunner.tsx`'s `run()`
 * function, generalized to run outside React/Zustand/IPC — the CLI runner
 * (`apps/cli`) is the first caller.
 */
export async function runCollection(input: CollectionRunInput, hooks: CollectionRunHooks = {}): Promise<CollectionRunSummary> {
  const { requests, collections = [], foldersByCollection = {}, globalVariables, environment, dataRows, chainRules = [], network, bail } = input
  const iterations = dataRows ? dataRows.length : Math.max(1, input.iterations ?? 1)
  const hasEnabledChain = chainRules.some((r) => r.enabled)
  const concurrency = hasEnabledChain ? 1 : Math.max(1, input.concurrency ?? 1)
  const delayMs = Math.max(0, input.delayMs ?? 0)
  const ruleFor = (requestId: string) => chainRules.find((r) => r.requestId === requestId)

  const client = new UndiciRequestClient()
  const startedAt = Date.now()
  const allResults: TestRunRequestResult[] = []
  const extractedVars: KV[] = []
  let jar = input.cookieJar ?? []
  let stop = false

  for (let iter = 0; iter < Math.max(1, iterations) && !stop; iter++) {
    const row = dataRows?.[iter % dataRows.length]
    const rowVars: KV[] = row ? Object.entries(row).map(([key, value]) => ({ key, value: String(value) })) : []

    let cursor = 0
    const runOne = async (req: RequestModel): Promise<void> => {
      if (stop) return
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs))

      const { response, cookieJar: nextJar } = await sendResolvedRequest({
        request: req,
        globalVariables,
        environment,
        extraVariables: [...extractedVars, ...rowVars],
        collections,
        foldersByCollection,
        cookieJar: jar,
        network,
        client,
      })
      jar = nextJar

      const rule = ruleFor(req.id)
      if (rule?.enabled && rule.jsonPath && rule.variableName) {
        const value = resolvePath(response.body, rule.jsonPath)
        if (value !== undefined) {
          const idx = extractedVars.findIndex((v) => v.key === rule.variableName)
          const entry = { key: rule.variableName, value: String(value) }
          if (idx === -1) extractedVars.push(entry)
          else extractedVars[idx] = entry
        }
      }

      const enabledAssertions = req.assertions.filter((a) => a.enabled)
      const assertionResults = evaluateAssertions(req.assertions, response)
      const status: RunStatus =
        enabledAssertions.length === 0 ? 'skip' : assertionResults.every((a) => a.passed) ? 'pass' : 'fail'

      const result: TestRunRequestResult = {
        requestId: req.id,
        requestName: req.name,
        status,
        durationMs: response.timeMs,
        assertionsPassed: assertionResults.filter((a) => a.passed).length,
        assertionsFailed: assertionResults.filter((a) => !a.passed).length,
        error: response.error?.message,
      }
      allResults.push(result)
      hooks.onResult?.(result, iter)
      if (bail && status === 'fail') stop = true
    }

    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < requests.length && !stop) {
        const req = requests[cursor++]
        if (req) await runOne(req)
      }
    })
    await Promise.all(workers)
  }

  return {
    startedAt,
    finishedAt: Date.now(),
    iterations: Math.max(1, iterations),
    results: allResults,
    passed: allResults.filter((r) => r.status === 'pass').length,
    failed: allResults.filter((r) => r.status === 'fail').length,
    skipped: allResults.filter((r) => r.status === 'skip').length,
    cookieJar: jar,
  }
}
