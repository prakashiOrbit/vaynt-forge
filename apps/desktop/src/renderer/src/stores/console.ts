import { create } from 'zustand'
import type { ConsoleEntry, ConsoleProtocol } from '@vayntforge/engine'

/** Console entries are session-only (never persisted) and capped so a long session doesn't grow unbounded. */
const MAX_ENTRIES = 500

function mkEntry(protocol: ConsoleProtocol, summary: string, extra: Partial<ConsoleEntry> = {}): ConsoleEntry {
  return { id: `console_${crypto.randomUUID()}`, timestamp: Date.now(), protocol, summary, ...extra }
}

interface ConsoleState {
  entries: ConsoleEntry[]
  bound: boolean
  add(entry: ConsoleEntry): void
  clear(): void
  /** Wires up every real-network push channel once (REST/GraphQL, plus the same WS/SSE/gRPC events the per-tab panels already consume). */
  bind(): void
}

export const useConsole = create<ConsoleState>()((set, get) => ({
  entries: [],
  bound: false,

  add: (entry) => set((s) => ({ entries: [...s.entries, entry].slice(-MAX_ENTRIES) })),

  clear: () => set({ entries: [] }),

  bind: () => {
    if (get().bound) return
    set({ bound: true })

    window.vayntforge.console.onEntry((entry) => get().add(entry))

    window.vayntforge.realtime.ws.onEvent((_channelId, evt) => {
      if (evt.kind === 'status') {
        get().add(mkEntry('ws', `WS ${evt.status}`))
      } else if (evt.kind === 'frame') {
        const arrow = evt.frame.direction === 'sent' ? '→' : '←'
        const bodyKey = evt.frame.direction === 'sent' ? 'requestBody' : 'responseBody'
        get().add(mkEntry('ws', `WS ${arrow} ${evt.frame.format}`, { [bodyKey]: evt.frame.payload }))
      } else {
        get().add(mkEntry('ws', `WS: ${evt.line}`))
      }
    })

    window.vayntforge.realtime.sse.onEvent((_channelId, evt) => {
      if (evt.kind === 'status') {
        get().add(mkEntry('sse', `SSE ${evt.status}`))
      } else if (evt.kind === 'event') {
        get().add(mkEntry('sse', `SSE event: ${evt.event.event}`, { responseBody: evt.event.data }))
      } else {
        get().add(mkEntry('sse', `SSE: ${evt.line}`))
      }
    })

    window.vayntforge.realtime.grpc.onFrame((_channelId, frame) => {
      const isOutgoing = frame.kind === 'sent' || frame.kind === 'started'
      const bodyKey = isOutgoing ? 'requestBody' : 'responseBody'
      const bodyText = frame.message !== undefined ? JSON.stringify(frame.message) : frame.text
      get().add(mkEntry('grpc', `gRPC [${frame.method}:${frame.kind}]`, bodyText !== undefined ? { [bodyKey]: bodyText } : {}))
    })
  },
}))
