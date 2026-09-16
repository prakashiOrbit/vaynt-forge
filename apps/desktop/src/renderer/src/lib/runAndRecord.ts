import type { Collection, Environment, Folder, RequestModel, Variable } from '@vayntforge/engine'
import { useData } from '../stores/data'
import { useResponses } from '../stores/responses'
import { useTemporaryVariables } from '../stores/temporaryVariables'
import { sendRequest, type KV, type SendResult } from './sendRequest'
import { applyEnvironmentPatch } from './environmentWriteback'

/**
 * Sends a request and records the result: writes into the per-tab responses
 * store (so the Response panel shows it if that tab is open), logs a history
 * entry, and persists any `pm.environment.set()` patch back into the real
 * environment — the side effects RequestBuilderPage's Send button has had
 * since Sprint 6 (history) and this session (environment writeback). Shared
 * with the Collections tree's single "Run" action so both behave
 * identically. The bulk Collection Runner does *not* go through this — it
 * calls `sendRequest` directly and applies the same writeback itself, since
 * it also needs the freshly-written environment threaded into the *next*
 * request in the same run, not just persisted for later.
 */
export async function runAndRecordRequest(params: {
  request: RequestModel
  tabId: string
  workspaceId: string
  environmentId: string
  globalVariables: Variable[]
  environment: Environment | undefined
  extraVariables?: KV[]
  /** Resolves the request's collection/folder inheritance chain (auth, collection variables, ancestor scripts) — omit for a context with no collection data in scope. */
  collections?: Collection[]
  foldersByCollection?: Record<string, Folder[]>
}): Promise<SendResult> {
  const { request, tabId, workspaceId, environmentId, globalVariables, environment, extraVariables, collections, foldersByCollection } = params
  useResponses.getState().setSending(tabId, true)
  const temporaryVariables = useTemporaryVariables.getState().list(workspaceId)
  const result = await sendRequest(request, globalVariables, environment, extraVariables, collections, foldersByCollection, temporaryVariables)
  useResponses.getState().setResult(tabId, result.response, { pre: result.preScript, post: result.postScript })
  const updatedEnvironment = applyEnvironmentPatch(environment, {
    ...result.preScript?.environmentPatch,
    ...result.postScript?.environmentPatch,
  })
  // Awaited, and sequenced before addHistory below: both saveEnvironment and
  // addHistory independently end with their own refresh() call, which
  // re-fetches and replaces the *entire* workspace bucket. Firing both as
  // fire-and-forget would let their relative timing decide which snapshot
  // "wins" the final bucket state — usually harmless, but a real risk here
  // specifically, since a slower addHistory round trip finishing after a
  // faster (but earlier-started) saveEnvironment one could overwrite with a
  // snapshot taken before this save's write had committed. Awaiting this one
  // first removes that risk instead of relying on it not manifesting.
  if (updatedEnvironment) await useData.getState().saveEnvironment(updatedEnvironment)
  const isFailure = Boolean(result.response.error) || result.response.status >= 500
  if (isFailure) {
    void useData.getState().addNotification({
      workspaceId,
      tone: 'error',
      title: 'Request failed',
      message: `${request.method} ${request.name} — ${result.response.error ? result.response.error.code : `${result.response.status} ${result.response.statusText}`}`,
      read: false,
      dismissed: false,
    })
  }
  void useData.getState().addHistory(workspaceId, {
    workspaceId,
    requestId: request.id,
    requestName: request.name,
    method: request.method,
    url: request.url,
    status: result.response.status,
    statusText: result.response.statusText,
    durationMs: result.response.timeMs,
    size: result.response.size,
    environmentId: environmentId || undefined,
    timestamp: Date.now(),
  })
  return result
}
