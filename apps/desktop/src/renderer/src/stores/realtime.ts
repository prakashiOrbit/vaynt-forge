import { create } from 'zustand'
import type { MockSseSession, MockWsSession, SseStatus, WsMessageFormat, WsStatus } from '@vayntforge/engine'
import { createMockWebSocket, createMockSse, executeGraphQL, formatGraphQL } from '@vayntforge/engine'
import type { KeyValueRow } from '@vayntforge/ui'

/** Per-tab WebSocket transient state. */
export interface WsTabState {
  kind: 'ws'
  url: string
  status: WsStatus
  format: WsMessageFormat
  frames: {
    id: string
    direction: 'sent' | 'received'
    format: string
    payload: string
    size: number
    timestamp: number
  }[]
  logs: string[]
  session?: MockWsSession
}

/** Per-tab SSE transient state. */
export interface SseTabState {
  kind: 'sse'
  status: SseStatus
  events: { id: string; event: string; data: string; timestamp: number }[]
  paused: boolean
  logs: string[]
  session?: MockSseSession
}

/** Per-tab GraphQL transient state. */
export interface GraphQLTabState {
  kind: 'graphql'
  sending: boolean
  endpoint: string
  query: string
  variables: string
  headers: KeyValueRow[]
  result?: { data?: Record<string, unknown>; errors?: { message: string }[]; formatted?: string }
}

/** Per-tab gRPC transient state. */
export interface GrpcTabState {
  kind: 'grpc'
  address: string
  frames: GrpcIncomingFrame[]
  connected: boolean
  bidiOpen: boolean
}

type ProtocolState = WsTabState | SseTabState | GraphQLTabState | GrpcTabState

/** Frame pushed back from the main-process gRPC server. */
export interface GrpcIncomingFrame {
  channelId: string
  kind: string
  method: string
  text?: string
  message?: unknown
  timestamp: number
}

const defaultWs = (): WsTabState => ({
  kind: 'ws',
  url: 'ws://demo.vayntforge.dev/chat',
  status: 'idle',
  format: 'json',
  frames: [],
  logs: [],
})
const defaultSse = (): SseTabState => ({ kind: 'sse', status: 'idle', events: [], paused: false, logs: [] })
const defaultGql = (): GraphQLTabState => ({
  kind: 'graphql',
  sending: false,
  endpoint: 'https://demo.vayntforge.dev/graphql',
  query: '{ me { id name } }',
  variables: '',
  headers: [],
})
const defaultGrpc = (): GrpcTabState => ({ kind: 'grpc', address: '', frames: [], connected: false, bidiOpen: false })

// Stable singletons for the "no tab entry yet" case. `useRealtime((s) => s.getWs(tabId))`
// is a zustand selector backed by `useSyncExternalStore` — if the fallback returned a
// fresh object on every call, React would see a new snapshot on every render and throw
// "Maximum update depth exceeded" the instant a brand-new tab first renders.
const EMPTY_WS = defaultWs()
const EMPTY_SSE = defaultSse()
const EMPTY_GQL = defaultGql()
const EMPTY_GRPC = defaultGrpc()

const nowText = () => new Date().toLocaleTimeString()

interface RealtimeState {
  entries: Record<string, ProtocolState>
  _grpcBound: boolean
  setWs(tabId: string, patch: Partial<Omit<WsTabState, 'kind'>>): void
  setSse(tabId: string, patch: Partial<Omit<SseTabState, 'kind'>>): void
  setGql(tabId: string, patch: Partial<Omit<GraphQLTabState, 'kind'>>): void
  setGrpc(tabId: string, patch: Partial<Omit<GrpcTabState, 'kind'>>): void
  getWs(tabId: string): WsTabState
  getSse(tabId: string): SseTabState
  getGql(tabId: string): GraphQLTabState
  getGrpc(tabId: string): GrpcTabState
  connectWs(tabId: string, url: string): void
  disconnectWs(tabId: string): void
  sendWs(tabId: string, text: string, format?: WsMessageFormat): void
  pingWs(tabId: string): void
  reconnectWs(tabId: string): void
  setWsFormat(tabId: string, format: WsMessageFormat): void
  clearWs(tabId: string): void
  connectSse(tabId: string, url: string): void
  pauseSse(tabId: string): void
  resumeSse(tabId: string): void
  closeSse(tabId: string): void
  reconnectSse(tabId: string): void
  clearSse(tabId: string): void
  executeGql(tabId: string, query: string, variables: string): void
  clearGql(tabId: string): void
  setGqlEndpoint(tabId: string, endpoint: string): void
  setGqlHeaders(tabId: string, headers: KeyValueRow[]): void
  grpcConnect(tabId: string, address: string): void
  grpcAddFrame(tabId: string, frame: GrpcIncomingFrame): void
  grpcCall(tabId: string, method: string, kind: 'unary' | 'server-stream' | 'client-stream', message: unknown): Promise<void>
  grpcBidiStart(tabId: string, method: string): Promise<void>
  grpcBidiSend(tabId: string, message: unknown): Promise<void>
  grpcBidiEnd(tabId: string): Promise<void>
  remove(tabId: string): void
  /** Single global listener wired to window.vayntforge.realtime.grpc.onFrame once. */
  bindGrpc(): void
}

export const useRealtime = create<RealtimeState>()((set, get) => ({
  entries: {},
  _grpcBound: false,

  setWs: (tabId, patch) =>
    set((s) => {
      const prev = s.entries[tabId]
      return { entries: { ...s.entries, [tabId]: { ...(prev && prev.kind === 'ws' ? prev : defaultWs()), ...patch } } }
    }),
  setSse: (tabId, patch) =>
    set((s) => {
      const prev = s.entries[tabId]
      return { entries: { ...s.entries, [tabId]: { ...(prev && prev.kind === 'sse' ? prev : defaultSse()), ...patch } } }
    }),
  setGql: (tabId, patch) =>
    set((s) => {
      const prev = s.entries[tabId]
      return { entries: { ...s.entries, [tabId]: { ...(prev && prev.kind === 'graphql' ? prev : defaultGql()), ...patch } } }
    }),
  setGrpc: (tabId, patch) =>
    set((s) => {
      const prev = s.entries[tabId]
      return { entries: { ...s.entries, [tabId]: { ...(prev && prev.kind === 'grpc' ? prev : defaultGrpc()), ...patch } } }
    }),

  getWs: (tabId) => {
    const e = get().entries[tabId]
    return e && e.kind === 'ws' ? e : EMPTY_WS
  },
  getSse: (tabId) => {
    const e = get().entries[tabId]
    return e && e.kind === 'sse' ? e : EMPTY_SSE
  },
  getGql: (tabId) => {
    const e = get().entries[tabId]
    return e && e.kind === 'graphql' ? e : EMPTY_GQL
  },
  getGrpc: (tabId) => {
    const e = get().entries[tabId]
    return e && e.kind === 'grpc' ? e : EMPTY_GRPC
  },

  connectWs: (tabId, url) => {
    const prev = get().entries[tabId]
    if (prev?.kind === 'ws') prev.session?.close()
    const session = createMockWebSocket(url, {
      onStatus: (status) => get().setWs(tabId, { status }),
      onFrame: (frame) => {
        const e = get().entries[tabId]
        if (e?.kind === 'ws') get().setWs(tabId, { frames: [...e.frames, frame] })
      },
      onLog: (log) => {
        const e = get().entries[tabId]
        if (e?.kind === 'ws') get().setWs(tabId, { logs: [...e.logs, `${nowText()} ${log}`] })
      },
    })
    set((s) => ({ entries: { ...s.entries, [tabId]: { ...defaultWs(), url, session, status: 'connecting' } } }))
  },

  disconnectWs: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') e.session?.close()
  },

  sendWs: (tabId, text) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') e.session?.send(text, e.format)
  },

  pingWs: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') e.session?.ping()
  },

  reconnectWs: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') e.session?.reconnect()
  },

  setWsFormat: (tabId, format) => get().setWs(tabId, { format }),

  clearWs: (tabId) => get().setWs(tabId, { frames: [], logs: [] }),

  connectSse: (tabId, url) => {
    const prev = get().entries[tabId]
    if (prev?.kind === 'sse') prev.session?.close()
    const session = createMockSse(url, {
      onStatus: (status) => get().setSse(tabId, { status }),
      onEvent: (evt) => {
        const e = get().entries[tabId]
        if (e?.kind === 'sse') get().setSse(tabId, { events: [...e.events, evt].slice(-200) })
      },
      onLog: (log) => {
        const e = get().entries[tabId]
        if (e?.kind === 'sse') get().setSse(tabId, { logs: [...e.logs, `${nowText()} ${log}`] })
      },
    })
    set((s) => ({ entries: { ...s.entries, [tabId]: { ...defaultSse(), session, status: 'connecting' } } }))
  },

  pauseSse: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'sse') {
      e.session?.pause()
      get().setSse(tabId, { paused: true })
    }
  },

  resumeSse: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'sse') {
      e.session?.resume()
      get().setSse(tabId, { paused: false })
    }
  },

  closeSse: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'sse') e.session?.close()
  },

  reconnectSse: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'sse') {
      e.session?.reconnect()
      get().setSse(tabId, { paused: false })
    }
  },

  clearSse: (tabId) => get().setSse(tabId, { events: [], logs: [] }),

  executeGql: (tabId, query, variables) => {
    const current = get().getGql(tabId)
    let vars: Record<string, string | number | boolean> = {}
    if (variables.trim()) {
      try {
        const parsed = JSON.parse(variables) as Record<string, unknown>
        for (const [k, v] of Object.entries(parsed)) {
          if (v !== null) vars[k] = v as string | number | boolean
        }
      } catch {
        // Keep plain object if the variables box holds invalid JSON.
      }
    }
    const result = executeGraphQL({ query, variables: vars, endpoint: current.endpoint })
    const formatted = formatGraphQL(query)
    get().setGql(tabId, { query, variables, result: { ...result, formatted } })
  },

  clearGql: (tabId) => get().setGql(tabId, { query: '', variables: '', result: undefined }),

  setGqlEndpoint: (tabId, endpoint) => get().setGql(tabId, { endpoint }),

  setGqlHeaders: (tabId, headers) => get().setGql(tabId, { headers }),

  grpcConnect: (tabId, address) =>
    set((s) => {
      const prev = s.entries[tabId]
      const base = prev && prev.kind === 'grpc' ? prev : defaultGrpc()
      return { entries: { ...s.entries, [tabId]: { ...base, address, connected: true } } }
    }),

  grpcAddFrame: (tabId, frame) =>
    set((s) => {
      const prev = s.entries[tabId]
      const base = prev && prev.kind === 'grpc' ? prev : defaultGrpc()
      const bidiOpen = frame.kind === 'started' && frame.method === 'Chat' ? true : frame.kind === 'end' ? false : base.bidiOpen
      const entry: GrpcTabState = { ...base, frames: [...base.frames, frame], bidiOpen }
      return { entries: { ...s.entries, [tabId]: entry } }
    }),

  grpcCall: async (tabId, method, kind, message) => {
    const api = window.vayntforge.realtime.grpc
    if (kind === 'unary') {
      await api.unary(tabId, method, message)
    } else if (kind === 'server-stream') {
      await api.serverStream(tabId, method, message)
    } else {
      const messages = Array.isArray(message) ? message : [message]
      await api.clientStream(tabId, method, messages)
    }
  },

  grpcBidiStart: async (tabId, method) => {
    await window.vayntforge.realtime.grpc.bidiStart(tabId, method)
  },

  grpcBidiSend: async (tabId, message) => {
    await window.vayntforge.realtime.grpc.bidiSend(tabId, message)
  },

  grpcBidiEnd: async (tabId) => {
    await window.vayntforge.realtime.grpc.bidiEnd(tabId)
  },

  remove: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') e.session?.close()
    if (e?.kind === 'sse') e.session?.close()
    set((s) => {
      const entries = { ...s.entries }
      delete entries[tabId]
      return { entries }
    })
  },

  bindGrpc: () => {
    if (get()._grpcBound) return
    set({ _grpcBound: true })
    window.vayntforge.realtime.grpc.onFrame((channelId, frame) => {
      get().grpcAddFrame(channelId, frame)
    })
  },
}))