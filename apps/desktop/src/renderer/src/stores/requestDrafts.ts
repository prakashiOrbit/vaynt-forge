import { create } from 'zustand'
import type { RequestModel } from '@vayntforge/engine'

interface RequestDraftsState {
  /** In-memory working copy per open tab id — never persisted, never lost on tab switch. */
  drafts: Record<string, RequestModel>
  ensure(tabId: string, base: RequestModel): void
  update(tabId: string, updater: (draft: RequestModel) => RequestModel): void
  reset(tabId: string, base: RequestModel): void
  remove(tabId: string): void
}

export const useRequestDrafts = create<RequestDraftsState>()((set, get) => ({
  drafts: {},
  ensure: (tabId, base) => {
    if (get().drafts[tabId]) return
    set((s) => ({ drafts: { ...s.drafts, [tabId]: base } }))
  },
  update: (tabId, updater) =>
    set((s) => {
      const current = s.drafts[tabId]
      if (!current) return s
      return { drafts: { ...s.drafts, [tabId]: updater(current) } }
    }),
  reset: (tabId, base) => set((s) => ({ drafts: { ...s.drafts, [tabId]: base } })),
  remove: (tabId) =>
    set((s) => {
      const drafts = { ...s.drafts }
      delete drafts[tabId]
      return { drafts }
    }),
}))

export function useRequestDraft(tabId: string | null): RequestModel | undefined {
  return useRequestDrafts((s) => (tabId ? s.drafts[tabId] : undefined))
}
