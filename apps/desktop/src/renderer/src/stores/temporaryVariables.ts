import { create } from 'zustand'
import type { Variable } from '@vayntforge/engine'

/**
 * Temporary-scoped variables — deliberately session-only, never persisted
 * to SQLite (no IPC calls in this file at all, unlike every other variable
 * scope's store). This is Postman's "Local variables" role: a scratch pad
 * cleared by simply closing the app, kept per-workspace for the same reason
 * global/environment/collection variables are.
 */
// A stable, shared reference for "no variables in this workspace yet" —
// `?? []` would mint a fresh array every call, which a selector hook like
// `useTemporaryVariables((s) => s.list(id))` sees as "changed" on every
// check (Zustand's default equality is reference-based), triggering
// runaway re-renders. The exact "Maximum update depth exceeded" bug
// Sprint 9's realtime store hit for the same reason — same fix here.
const EMPTY: Variable[] = []

interface TemporaryVariablesState {
  byWorkspace: Record<string, Variable[]>
  list(workspaceId: string): Variable[]
  save(workspaceId: string, variable: Variable): void
  remove(workspaceId: string, id: string): void
}

export const useTemporaryVariables = create<TemporaryVariablesState>()((set, get) => ({
  byWorkspace: {},
  list: (workspaceId) => get().byWorkspace[workspaceId] ?? EMPTY,
  save: (workspaceId, variable) =>
    set((s) => {
      const existing = s.byWorkspace[workspaceId] ?? []
      const next = existing.some((v) => v.id === variable.id)
        ? existing.map((v) => (v.id === variable.id ? variable : v))
        : [...existing, variable]
      return { byWorkspace: { ...s.byWorkspace, [workspaceId]: next } }
    }),
  remove: (workspaceId, id) =>
    set((s) => ({
      byWorkspace: { ...s.byWorkspace, [workspaceId]: (s.byWorkspace[workspaceId] ?? []).filter((v) => v.id !== id) },
    })),
}))
