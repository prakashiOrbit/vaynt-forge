import type { MockSseSession, SseEvent, SseHandlers, SseStatus } from './types'

/**
 * Sprint 9 — mock Server-Sent Events stream. Emits a believable, endless demo
 * event feed (order lifecycle + ping keep-alives) that can be paused and
 * resumed without tearing the UI. Uses `https://demo.vayntforge.dev/events`.
 */

const EVENT_TYPES = ['order.created', 'order.updated', 'order.deleted', 'stock.updated', 'message'] as const

const PAYLOADS: Record<string, string> = {
  'order.created': '{"orderId":"ord_901","total":84.98}',
  'order.updated': '{"orderId":"ord_902","status":"PROCESSING"}',
  'order.deleted': '{"orderId":"ord_903","reason":"customer.cancelled"}',
  'stock.updated': '{"sku":"acme-1","qty":42}',
  message: '{"text":"connection: 12 peers online"}',
}

export function createMockSse(url: string, handlers: SseHandlers): MockSseSession {
  let status: SseStatus = 'idle'
  let paused = false
  let timers: ReturnType<typeof setTimeout>[] = []
  let running = false
  let tick = 0

  const setStatus = (next: SseStatus, log?: string) => {
    status = next
    handlers.onStatus(next)
    if (log) handlers.onLog(log)
  }

  const schedule = (fn: () => void, ms: number) => {
    const handle = setTimeout(fn, ms)
    timers.push(handle)
  }

  const emit = (): SseEvent => {
    const type = EVENT_TYPES[tick % EVENT_TYPES.length] ?? 'message'
    tick++
    const offset = Math.max(0, (tick - 1) * 2400)
    const event: SseEvent = {
      id: `evt_${String(tick).padStart(4, '0')}`,
      event: type,
      data: PAYLOADS[type] ?? '{}',
      timestamp: Date.now(),
      retry: 1500,
    }
    void offset
    handlers.onEvent(event)
    return event
  }

  const loop = () => {
    if (!running) return
    if (!paused) emit()
    schedule(loop, 500 + (tick % 3) * 125)
  }

  const connect = () => {
    running = true
    paused = false
    setStatus('connecting', `[sse] connecting ${url}`)
    schedule(() => {
      if (!running) return
      setStatus('open', '[sse] stream open (text/event-stream)')
      schedule(() => handlers.onLog('[sse] retry: 1500ms'), 40)
      loop()
    }, 180)
  }

  connect()

  return {
    get status() {
      return status
    },
    get paused() {
      return paused
    },
    handledByMock: true,
    pause: () => {
      if (paused || status !== 'open') return
      paused = true
      handlers.onLog('[sse] stream paused')
    },
    resume: () => {
      if (!paused) return
      paused = false
      handlers.onLog('[sse] stream resumed')
    },
    close: () => {
      if (status === 'idle' || status === 'closed') return
      running = false
      for (const t of timers) clearTimeout(t)
      timers = []
      setStatus('closed', '[sse] stream closed')
    },
    reconnect: () => {
      if (!running && status !== 'closed') return
      running = true
      tick = 0
      handlers.onLog('[sse] reconnect in 250ms…')
      schedule(() => connect(), 250)
    },
  }
}