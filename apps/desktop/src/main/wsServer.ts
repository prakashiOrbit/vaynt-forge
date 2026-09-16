import { randomUUID } from 'node:crypto'
import WebSocket from 'ws'
import type { WsFrame, WsMessageFormat, WsPushEvent } from '@vayntforge/engine'

/**
 * Real WebSocket connections, one per renderer tab (`channelId` == tab id).
 * Runs in the main process — `ws` gives real handshakes, ping/pong control
 * frames, and close codes, none of which the browser's `WebSocket` exposes.
 * Mirrors the gRPC main-process pattern (grpcServer.ts): a `Map` keyed by
 * channelId, frames pushed back to the renderer via an `emit` callback bound
 * to the invoking window's `WebContents`.
 */

type Emit = (channelId: string, event: WsPushEvent) => void

interface WsConn {
  socket: WebSocket
}

const conns = new Map<string, WsConn>()

function makeFrame(direction: WsFrame['direction'], format: WsMessageFormat, payload: string, size: number): WsFrame {
  return { id: randomUUID(), direction, format, payload, size, timestamp: Date.now() }
}

function detectFormat(text: string): WsMessageFormat {
  try {
    JSON.parse(text)
    return 'json'
  } catch {
    return 'text'
  }
}

export function wsConnect(channelId: string, url: string, emit: Emit): void {
  wsClose(channelId, emit, /* silent */ true)

  emit(channelId, { kind: 'status', status: 'connecting' })
  emit(channelId, { kind: 'log', line: `Connecting to ${url}` })

  let socket: WebSocket
  try {
    socket = new WebSocket(url)
  } catch (err) {
    emit(channelId, { kind: 'status', status: 'closed' })
    emit(channelId, { kind: 'log', line: `Connect failed: ${err instanceof Error ? err.message : String(err)}` })
    return
  }

  conns.set(channelId, { socket })

  socket.on('open', () => {
    emit(channelId, { kind: 'status', status: 'connected' })
    emit(channelId, { kind: 'log', line: 'Connected' })
  })

  socket.on('message', (data, isBinary) => {
    if (isBinary) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      emit(channelId, { kind: 'frame', frame: makeFrame('received', 'base64', buf.toString('base64'), buf.length) })
      return
    }
    const text = data.toString('utf8')
    emit(channelId, { kind: 'frame', frame: makeFrame('received', detectFormat(text), text, Buffer.byteLength(text)) })
  })

  socket.on('pong', () => {
    emit(channelId, { kind: 'frame', frame: makeFrame('received', 'text', 'PONG', 4) })
  })

  socket.on('close', (code, reasonBuf) => {
    const reason = reasonBuf.toString('utf8')
    emit(channelId, { kind: 'status', status: 'closed' })
    emit(channelId, { kind: 'log', line: `Closed (${code}${reason ? `: ${reason}` : ''})` })
    conns.delete(channelId)
  })

  socket.on('error', (err) => {
    emit(channelId, { kind: 'log', line: `Error: ${err.message}` })
  })
}

export function wsSend(channelId: string, text: string, format: WsMessageFormat, emit: Emit): void {
  const conn = conns.get(channelId)
  if (!conn || conn.socket.readyState !== WebSocket.OPEN) {
    emit(channelId, { kind: 'log', line: 'Send ignored — socket not connected' })
    return
  }
  if (format === 'base64') {
    const buf = Buffer.from(text, 'base64')
    conn.socket.send(buf)
    emit(channelId, { kind: 'frame', frame: makeFrame('sent', format, text, buf.length) })
  } else {
    conn.socket.send(text)
    emit(channelId, { kind: 'frame', frame: makeFrame('sent', format, text, Buffer.byteLength(text)) })
  }
}

export function wsPing(channelId: string, emit: Emit): void {
  const conn = conns.get(channelId)
  if (!conn || conn.socket.readyState !== WebSocket.OPEN) {
    emit(channelId, { kind: 'log', line: 'Ping ignored — socket not connected' })
    return
  }
  conn.socket.ping()
  emit(channelId, { kind: 'frame', frame: makeFrame('sent', 'text', 'PING', 4) })
}

export function wsClose(channelId: string, emit: Emit, silent = false): void {
  const conn = conns.get(channelId)
  if (!conn) return
  conn.socket.removeAllListeners()
  try {
    conn.socket.close()
  } catch {
    /* already closing/closed */
  }
  conns.delete(channelId)
  if (!silent) emit(channelId, { kind: 'status', status: 'closed' })
}
