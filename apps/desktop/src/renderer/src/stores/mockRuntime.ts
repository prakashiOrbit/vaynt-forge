import { create } from 'zustand'
import type { MockLogEntry, MockServer } from '@vayntforge/engine'
import { toast } from '@vayntforge/ui'
import { useData } from './data'

/** Sprint 10 — live (in-memory) request log per running mock server, fed by
 * `window.vayntforge.mock.onLog`. The persisted `MockServer.log` field is the
 * source of truth once a server is stopped; this store is the source of
 * truth for the log while it's running (avoids a DB write per request). */
interface MockRuntimeState {
  liveLogs: Record<string, MockLogEntry[]>
  pending: Record<string, boolean>
  _bound: boolean
  bind(): void
  start(server: MockServer): Promise<void>
  stop(server: MockServer): Promise<void>
  restart(server: MockServer): Promise<void>
  clearLog(serverId: string): void
}

const MAX_LOG = 200

export const useMockRuntime = create<MockRuntimeState>()((set, get) => ({
  liveLogs: {},
  pending: {},
  _bound: false,

  bind: () => {
    if (get()._bound) return
    set({ _bound: true })
    window.vayntforge.mock.onLog((serverId, entry) => {
      set((s) => ({
        liveLogs: { ...s.liveLogs, [serverId]: [...(s.liveLogs[serverId] ?? []), entry].slice(-MAX_LOG) },
      }))
    })
  },

  start: async (server) => {
    set((s) => ({ pending: { ...s.pending, [server.id]: true } }))
    try {
      await window.vayntforge.mock.start(server)
      set((s) => ({ liveLogs: { ...s.liveLogs, [server.id]: [] } }))
      await useData.getState().saveMockServer({ ...server, status: 'running' })
      toast.success('Mock server started', `${server.name} · http://localhost:${server.port}`)
    } catch (err) {
      toast.error('Failed to start mock server', err instanceof Error ? err.message : String(err))
    } finally {
      set((s) => ({ pending: { ...s.pending, [server.id]: false } }))
    }
  },

  stop: async (server) => {
    set((s) => ({ pending: { ...s.pending, [server.id]: true } }))
    try {
      await window.vayntforge.mock.stop(server.id)
      const finalLog = get().liveLogs[server.id] ?? server.log
      await useData.getState().saveMockServer({ ...server, status: 'stopped', log: finalLog.slice(-MAX_LOG) })
      toast.success('Mock server stopped', server.name)
    } finally {
      set((s) => ({ pending: { ...s.pending, [server.id]: false } }))
    }
  },

  restart: async (server) => {
    await get().stop(server)
    await get().start({ ...server, status: 'stopped' })
  },

  clearLog: (serverId) => set((s) => ({ liveLogs: { ...s.liveLogs, [serverId]: [] } })),
}))
