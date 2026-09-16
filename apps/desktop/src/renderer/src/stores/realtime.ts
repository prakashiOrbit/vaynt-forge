import { create } from 'zustand'
import type {
  Environment,
  GrpcService,
  KeyValuePair,
  RequestModel,
  ResponseModel,
  SseStatus,
  Variable,
  WsMessageFormat,
  WsStatus,
} from '@vayntforge/engine'
import { createDraftRequest } from '@vayntforge/engine'
import type { KeyValueRow } from '@vayntforge/ui'
import { sendRequest } from '../lib/sendRequest'

/** Per-tab WebSocket transient state. Backed by a real `ws` socket in the main process (see main/wsServer.ts), routed by tabId as the IPC channelId. */
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
}

/** Per-tab SSE transient state. Backed by a real streamed `undici` GET in the main process (see main/sseServer.ts), routed by tabId as the IPC channelId. */
export interface SseTabState {
  kind: 'sse'
  url: string
  status: SseStatus
  events: { id: string; event: string; data: string; timestamp: number }[]
  paused: boolean
  logs: string[]
}

/** Per-tab GraphQL transient state. */
export interface GraphQLTabState {
  kind: 'graphql'
  sending: boolean
  endpoint: string
  query: string
  variables: string
  headers: KeyValueRow[]
  result?: { data?: Record<string, unknown>; errors?: { message: string }[] }
}

/** Per-tab gRPC transient state. Backed by a real per-channel `@grpc/grpc-js` client in the main process (see main/grpcServer.ts), routed by tabId as the IPC channelId — either the in-app demo server, or a real external target discovered via reflection or an imported `.proto` file. */
export interface GrpcTabState {
  kind: 'grpc'
  address: string
  tls: boolean
  services: GrpcService[]
  protoSource?: string
  frames: GrpcIncomingFrame[]
  connected: boolean
  connecting: boolean
  bidiOpen: boolean
  error?: string
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
const defaultSse = (): SseTabState => ({
  kind: 'sse',
  url: 'https://demo.vayntforge.dev/events',
  status: 'idle',
  events: [],
  paused: false,
  logs: [],
})
const defaultGql = (): GraphQLTabState => ({
  kind: 'graphql',
  sending: false,
  endpoint: 'https://demo.vayntforge.dev/graphql',
  query: '{ me { id name } }',
  variables: '',
  headers: [],
})
const defaultGrpc = (): GrpcTabState => ({
  kind: 'grpc',
  address: '',
  tls: false,
  services: [],
  frames: [],
  connected: false,
  connecting: false,
  bidiOpen: false,
})

// Stable singletons for the "no tab entry yet" case. `useRealtime((s) => s.getWs(tabId))`
// is a zustand selector backed by `useSyncExternalStore` — if the fallback returned a
// fresh object on every call, React would see a new snapshot on every render and throw
// "Maximum update depth exceeded" the instant a brand-new tab first renders.
const EMPTY_WS = defaultWs()
const EMPTY_SSE = defaultSse()
const EMPTY_GQL = defaultGql()
const EMPTY_GRPC = defaultGrpc()

const nowText = () => new Date().toLocaleTimeString()

/** Maps a real HTTP response onto the GraphQL result shape the panel renders. */
function mapGqlResult(response: ResponseModel): GraphQLTabState['result'] {
  if (response.error) return { errors: [{ message: response.error.message }] }
  const body = response.body as { data?: Record<string, unknown>; errors?: { message: string }[] } | undefined
  if (body && typeof body === 'object' && ('data' in body || 'errors' in body)) {
    return { data: body.data, errors: body.errors }
  }
  if (response.status >= 400) {
    return { errors: [{ message: `${response.status} ${response.statusText}: ${response.bodyText.slice(0, 500)}` }] }
  }
  return { data: body as Record<string, unknown> | undefined }
}

interface RealtimeState {
  entries: Record<string, ProtocolState>
  _grpcBound: boolean
  _wsBound: boolean
  _sseBound: boolean
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
  executeGql(
    tabId: string,
    query: string,
    variables: string,
    ctx: { workspaceId: string; globalVariables: Variable[]; environment?: Environment }
  ): Promise<void>
  clearGql(tabId: string): void
  setGqlEndpoint(tabId: string, endpoint: string): void
  setGqlHeaders(tabId: string, headers: KeyValueRow[]): void
  grpcAddFrame(tabId: string, frame: GrpcIncomingFrame): void
  grpcCall(tabId: string, method: string, kind: 'unary' | 'server-stream' | 'client-stream', message: unknown): Promise<void>
  grpcBidiStart(tabId: string, method: string): Promise<void>
  grpcBidiSend(tabId: string, message: unknown): Promise<void>
  grpcBidiEnd(tabId: string): Promise<void>
  /** Starts (or reuses) the in-app demo server for this tab. */
  grpcStartDemo(tabId: string): Promise<void>
  /** Connects this tab to a real external gRPC target — via `protoPath`, or (when omitted) server reflection. */
  grpcConnectExternal(tabId: string, address: string, tls: boolean, protoPath?: string): Promise<void>
  grpcDisconnect(tabId: string): Promise<void>
  remove(tabId: string): void
  /** Single global listener wired to window.vayntforge.realtime.grpc.onFrame once. */
  bindGrpc(): void
  /** Single global listener wired to window.vayntforge.realtime.ws.onEvent once. */
  bindWs(): void
  /** Single global listener wired to window.vayntforge.realtime.sse.onEvent once. */
  bindSse(): void
}

export const useRealtime = create<RealtimeState>()((set, get) => ({
  entries: {},
  _grpcBound: false,
  _wsBound: false,
  _sseBound: false,

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
    set((s) => ({ entries: { ...s.entries, [tabId]: { ...defaultWs(), url, status: 'connecting' } } }))
    void window.vayntforge.realtime.ws.connect(tabId, url)
  },

  disconnectWs: (tabId) => {
    void window.vayntforge.realtime.ws.close(tabId)
  },

  sendWs: (tabId, text) => {
    const e = get().entries[tabId]
    if (e?.kind !== 'ws' || e.status !== 'connected') return
    void window.vayntforge.realtime.ws.send(tabId, text, e.format)
  },

  pingWs: (tabId) => {
    void window.vayntforge.realtime.ws.ping(tabId)
  },

  reconnectWs: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind !== 'ws' || !e.url) return
    get().setWs(tabId, { status: 'connecting' })
    void window.vayntforge.realtime.ws.connect(tabId, e.url)
  },

  setWsFormat: (tabId, format) => get().setWs(tabId, { format }),

  clearWs: (tabId) => get().setWs(tabId, { frames: [], logs: [] }),

  connectSse: (tabId, url) => {
    set((s) => ({ entries: { ...s.entries, [tabId]: { ...defaultSse(), url, status: 'connecting' } } }))
    void window.vayntforge.realtime.sse.connect(tabId, url)
  },

  pauseSse: (tabId) => get().setSse(tabId, { paused: true }),

  resumeSse: (tabId) => get().setSse(tabId, { paused: false }),

  closeSse: (tabId) => {
    void window.vayntforge.realtime.sse.close(tabId)
  },

  reconnectSse: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind !== 'sse' || !e.url) return
    get().setSse(tabId, { paused: false, status: 'connecting' })
    void window.vayntforge.realtime.sse.connect(tabId, e.url)
  },

  clearSse: (tabId) => get().setSse(tabId, { events: [], logs: [] }),

  executeGql: async (tabId, query, variables, ctx) => {
    const current = get().getGql(tabId)
    get().setGql(tabId, { query, variables, sending: true })
    const request: RequestModel = {
      ...createDraftRequest({ id: `gql_${tabId}`, workspaceId: ctx.workspaceId, method: 'POST', url: current.endpoint }),
      headers: current.headers as KeyValuePair[],
      body: { type: 'graphql', query, variables },
    }
    try {
      const { response } = await sendRequest(request, ctx.globalVariables, ctx.environment)
      get().setGql(tabId, { sending: false, result: mapGqlResult(response) })
    } catch (err) {
      get().setGql(tabId, {
        sending: false,
        result: { errors: [{ message: err instanceof Error ? err.message : String(err) }] },
      })
    }
  },

  clearGql: (tabId) => get().setGql(tabId, { query: '', variables: '', result: undefined }),

  setGqlEndpoint: (tabId, endpoint) => get().setGql(tabId, { endpoint }),

  setGqlHeaders: (tabId, headers) => get().setGql(tabId, { headers }),

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

  grpcStartDemo: async (tabId) => {
    get().setGrpc(tabId, { connecting: true, error: undefined })
    try {
      const { address, services, protoSource } = await window.vayntforge.realtime.grpc.start(tabId)
      get().setGrpc(tabId, { address, tls: false, services, protoSource, connected: true, connecting: false })
    } catch (err) {
      get().setGrpc(tabId, { connecting: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  grpcConnectExternal: async (tabId, address, tls, protoPath) => {
    get().setGrpc(tabId, { connecting: true, error: undefined })
    try {
      const { services, protoSource } = await window.vayntforge.realtime.grpc.connectExternal(tabId, address, tls, protoPath)
      get().setGrpc(tabId, { address, tls, services, protoSource, connected: true, connecting: false })
    } catch (err) {
      get().setGrpc(tabId, { connected: false, connecting: false, error: err instanceof Error ? err.message : String(err) })
    }
  },

  grpcDisconnect: async (tabId) => {
    await window.vayntforge.realtime.grpc.disconnect(tabId)
    set((s) => ({ entries: { ...s.entries, [tabId]: defaultGrpc() } }))
  },

  remove: (tabId) => {
    const e = get().entries[tabId]
    if (e?.kind === 'ws') void window.vayntforge.realtime.ws.close(tabId)
    if (e?.kind === 'sse') void window.vayntforge.realtime.sse.close(tabId)
    if (e?.kind === 'grpc') void window.vayntforge.realtime.grpc.disconnect(tabId)
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

  bindWs: () => {
    if (get()._wsBound) return
    set({ _wsBound: true })
    window.vayntforge.realtime.ws.onEvent((channelId, evt) => {
      if (evt.kind === 'status') {
        get().setWs(channelId, { status: evt.status })
      } else if (evt.kind === 'frame') {
        const e = get().entries[channelId]
        if (e?.kind === 'ws') get().setWs(channelId, { frames: [...e.frames, evt.frame] })
      } else {
        const e = get().entries[channelId]
        if (e?.kind === 'ws') get().setWs(channelId, { logs: [...e.logs, `${nowText()} ${evt.line}`] })
      }
    })
  },

  bindSse: () => {
    if (get()._sseBound) return
    set({ _sseBound: true })
    window.vayntforge.realtime.sse.onEvent((channelId, evt) => {
      if (evt.kind === 'status') {
        get().setSse(channelId, { status: evt.status })
      } else if (evt.kind === 'event') {
        const e = get().entries[channelId]
        if (e?.kind === 'sse' && !e.paused) get().setSse(channelId, { events: [...e.events, evt.event].slice(-200) })
      } else {
        const e = get().entries[channelId]
        if (e?.kind === 'sse') get().setSse(channelId, { logs: [...e.logs, `${nowText()} ${evt.line}`] })
      }
    })
  },
}))