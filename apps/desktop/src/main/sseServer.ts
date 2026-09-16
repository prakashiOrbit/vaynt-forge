import { request } from 'undici'
import type { SsePushEvent } from '@vayntforge/engine'

/**
 * Real Server-Sent Events, one long-lived streamed GET per renderer tab
 * (`channelId` == tab id). The browser's `EventSource` can't be driven from
 * the main process and offers no way to inspect the raw stream, so this
 * parses `text/event-stream` by hand over an `undici` streamed response body
 * — the same HTTP stack `UndiciRequestClient` already uses for real REST
 * requests. Mirrors the gRPC/WebSocket main-process pattern: a `Map` keyed
 * by channelId holding an `AbortController` to cancel on close.
 */

interface SseConn {
  controller: AbortController
}

const conns = new Map<string, SseConn>()

/** Parses one `text/event-stream` body, emitting a {@link SseEvent} per blank-line-delimited block. */
async function pump(channelId: string, body: AsyncIterable<Uint8Array>, emit: (channelId: string, event: SsePushEvent) => void): Promise<void> {
  let buffer = ''
  let curId: string | undefined
  let curEvent = 'message'
  let curData: string[] = []

  const flush = () => {
    if (curData.length === 0 && curEvent === 'message' && curId === undefined) return
    emit(channelId, {
      kind: 'event',
      event: { id: curId ?? randomEventId(), event: curEvent, data: curData.join('\n'), timestamp: Date.now() },
    })
    curId = undefined
    curEvent = 'message'
    curData = []
  }

  for await (const chunk of body) {
    buffer += Buffer.from(chunk).toString('utf8')
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const rawLine = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine

      if (line === '') {
        flush()
        continue
      }
      if (line.startsWith(':')) continue // comment line

      const colonIdx = line.indexOf(':')
      const field = colonIdx === -1 ? line : line.slice(0, colonIdx)
      const value = colonIdx === -1 ? '' : line.slice(colonIdx + 1).replace(/^ /, '')

      if (field === 'id') curId = value
      else if (field === 'event') curEvent = value
      else if (field === 'data') curData.push(value)
      else if (field === 'retry') emit(channelId, { kind: 'log', line: `retry: ${value}ms` })
    }
  }
}

let eventCounter = 0
function randomEventId(): string {
  eventCounter += 1
  return `evt_${eventCounter}`
}

export async function sseConnect(channelId: string, url: string, emit: (channelId: string, event: SsePushEvent) => void): Promise<void> {
  sseClose(channelId, emit, /* silent */ true)

  const controller = new AbortController()
  conns.set(channelId, { controller })

  emit(channelId, { kind: 'status', status: 'connecting' })
  emit(channelId, { kind: 'log', line: `Connecting to ${url}` })

  try {
    const { statusCode, body, headers } = await request(url, {
      method: 'GET',
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })

    if (statusCode >= 400) {
      emit(channelId, { kind: 'status', status: 'closed' })
      emit(channelId, { kind: 'log', line: `Connect failed: HTTP ${statusCode}` })
      conns.delete(channelId)
      return
    }

    emit(channelId, { kind: 'status', status: 'open' })
    emit(channelId, { kind: 'log', line: `Connected (content-type: ${headers['content-type'] ?? 'unknown'})` })

    await pump(channelId, body, emit)

    emit(channelId, { kind: 'status', status: 'closed' })
    emit(channelId, { kind: 'log', line: 'Stream ended' })
  } catch (err) {
    if (controller.signal.aborted) {
      emit(channelId, { kind: 'log', line: 'Connection closed' })
    } else {
      emit(channelId, { kind: 'status', status: 'closed' })
      emit(channelId, { kind: 'log', line: `Error: ${err instanceof Error ? err.message : String(err)}` })
    }
  } finally {
    conns.delete(channelId)
  }
}

export function sseClose(channelId: string, emit: (channelId: string, event: SsePushEvent) => void, silent = false): void {
  const conn = conns.get(channelId)
  if (!conn) return
  conn.controller.abort()
  conns.delete(channelId)
  if (!silent) emit(channelId, { kind: 'status', status: 'closed' })
}
