import type { Environment, RequestModel, Variable } from '@vayntforge/engine'
import { useData } from '../stores/data'
import { useResponses } from '../stores/responses'
import { sendRequest, type KV, type SendResult } from './sendRequest'

/**
 * Sends a request and records the result: writes into the per-tab responses
 * store (so the Response panel shows it if that tab is open) and logs a
 * history entry — the same two side effects RequestBuilderPage's Send button
 * has had since Sprint 6. Shared with the Collections tree's "Run" action and
 * the Collection Runner so all three paths behave identically.
 */
export async function runAndRecordRequest(params: {
  request: RequestModel
  tabId: string
  workspaceId: string
  environmentId: string
  globalVariables: Variable[]
  environment: Environment | undefined
  extraVariables?: KV[]
}): Promise<SendResult> {
  const { request, tabId, workspaceId, environmentId, globalVariables, environment, extraVariables } = params
  useResponses.getState().setSending(tabId, true)
  const result = await sendRequest(request, globalVariables, environment, extraVariables)
  useResponses.getState().setResult(tabId, result.response, { pre: result.preScript, post: result.postScript })
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
