import { create } from 'zustand'
import type { ResponseModel, ScriptResult } from '@vayntforge/engine'

export interface ResponseEntry {
  sending: boolean
  response?: ResponseModel
  preScript?: ScriptResult
  postScript?: ScriptResult
}

interface ResponsesState {
  entries: Record<string, ResponseEntry>
  setSending(tabId: string, sending: boolean): void
  setResult(tabId: string, response: ResponseModel, scripts?: { pre?: ScriptResult; post?: ScriptResult }): void
  remove(tabId: string): void
}

export const useResponses = create<ResponsesState>()((set) => ({
  entries: {},
  setSending: (tabId, sending) =>
    set((s) => ({ entries: { ...s.entries, [tabId]: { ...(s.entries[tabId] ?? {}), sending } } })),
  setResult: (tabId, response, scripts) =>
    set((s) => ({
      entries: {
        ...s.entries,
        [tabId]: { sending: false, response, preScript: scripts?.pre, postScript: scripts?.post },
      },
    })),
  remove: (tabId) =>
    set((s) => {
      const entries = { ...s.entries }
      delete entries[tabId]
      return { entries }
    }),
}))

export function useResponseEntry(tabId: string | null): ResponseEntry | undefined {
  return useResponses((s) => (tabId ? s.entries[tabId] : undefined))
}
