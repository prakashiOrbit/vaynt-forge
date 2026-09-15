import { generateId } from '../util/id'
import type { MockWsSession, WsHandlers, WsMessageFormat, WsStatus } from './types'

/**
 * Sprint 9 — mock WebSocket client. Mirrors `MockRequestClient`: it resolves
 * nothing over the wire (demo endpoints don't resolve to a real server), and
 * instead simulates a believable connect handshake, bidirectional frames, and
 * ping/pong. Uses `ws://demo.vayntforge.dev/…` URLs in the UI.
 */

const INCOMING_TEXT: Record<string, string> = {
  '/chat': '{"type":"chat","from":"alice","text":"hey! are you live?"}',
  '/orders': '{"type":"order_update","orderId":"ord_901","status":"PROCESSING"}',
  '/echo': '{"type":"echo_ready","message":"echo broker ready"}',
}

const SEQUENCE: { delay: number; text: string }[] = [
  { delay: 180, text: '{"type":"connection_ack","sessionId":"ws_01J4","protocol":"demo"}' },
  { delay: 260, text: '{"type":"status","count":12}' },
  { delay: 300, text: '{"type":"heartbeat","every":"30s"}' },
]

export function createMockWebSocket(url: string, handlers: WsHandlers): MockWsSession {
  let status: WsStatus = 'idle'
  let timers: ReturnType<typeof setTimeout>[] = []
  let closedByUser = false
  const path = (() => {
    try {
      return new URL(url).pathname || '/echo'
    } catch {
      return '/echo'
    }
  })()

  const setStatus = (next: WsStatus, log?: string) => {
    status = next
    handlers.onStatus(next)
    if (log) handlers.onLog(log)
  }

  const pushFrame = (direction: 'sent' | 'received', payload: string, format: WsMessageFormat): void => {
    handlers.onFrame({
      id: generateId('ws'),
      direction,
      format,
      payload,
      size: new TextEncoder().encode(payload).byteLength,
      timestamp: Date.now(),
    })
  }

  const schedule = (fn: () => void, ms: number) => {
    const handle = setTimeout(fn, ms)
    timers.push(handle)
  }

  const connect = () => {
    setStatus('connecting', `[connect] opening ${url}`)
    schedule(() => {
      if (closedByUser) return
      setStatus('connected', `[connect] handshake complete`)
      for (const step of SEQUENCE) {
        schedule(() => pushFrame('received', step.text, 'json'), step.delay)
      }
      // A short-lived peer-initiated conversation.
      schedule(() => pushFrame('received', INCOMING_TEXT[path] ?? '{"type":"ping"}', 'json'), 900)
      schedule(() => pushFrame('received', INCOMING_TEXT[path] ?? '{"type":"ping"}', 'json'), 1400)
    }, 160)
  }

  const tearDown = (log: string) => {
    for (const t of timers) clearTimeout(t)
    timers = []
    setStatus('closing', log)
    schedule(() => setStatus('closed'), 120)
  }

  connect()

  return {
    get status() {
      return status
    },
    handledByMock: true,
    send: (text: string, format: WsMessageFormat = 'json') => {
      if (status !== 'connected') {
        handlers.onLog('[send] ignored — socket not connected')
        return
      }
      pushFrame('sent', text, format)
      handlers.onLog('[send] 1 frame queued')
      // Echo (JSON responses echo the payload back unchanged; text frames
      // come back prefixed to make the round-trip visible).
      schedule(() => {
        if (status !== 'connected') return
        const echoed = format === 'json' ? text : `echo: ${text}`
        pushFrame('received', echoed, format)
      }, 220 + Math.random() * 160)
    },
    ping: () => {
      if (status !== 'connected') {
        handlers.onLog('[ping] ignored — socket not connected')
        return
      }
      pushFrame('sent', '🖒 PING', 'text')
      handlers.onLog('[ping] frame sent')
      schedule(() => {
        if (status !== 'connected') return
        pushFrame('received', '{"type":"pong","echo":"pong"}', 'json')
        handlers.onLog('[ping] pong received')
      }, 90 + Math.random() * 120)
    },
    reconnect: () => {
      if (status !== 'closed' && status !== 'idle') return
      closedByUser = false
      handlers.onLog('[reconnect] retrying in 250ms…')
      schedule(() => connect(), 250)
    },
    close: () => {
      if (status === 'idle' || status === 'closed') return
      closedByUser = true
      tearDown('[close] connection closed by client')
    },
  }
}