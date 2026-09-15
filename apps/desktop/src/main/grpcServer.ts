import * as grpc from '@grpc/grpc-js'
import type { GrpcFrame, GrpcMetadataArg } from '@vayntforge/engine'

/**
 * Sprint 9 — the in-app gRPC demo server.
 *
 * The roadmap asks for a real, hosted gRPC service (not a mock), so this uses
 * `@grpc/grpc-js` with a JSON wire format (protobuf-free) — every method
 * serialises/deserialises with `JSON.parse/stringify`. The renderer talks to
 * it over IPC; server-stream and bidi frames are pushed back with a
 * per-tab `channelId`. The engine exports the matching human-readable proto
 * (DEMO_PROTO) and service descriptors for the explorer.
 */

const serialize = (v: unknown): Buffer => Buffer.from(JSON.stringify(v))
const deserialize = (b: Buffer): unknown => JSON.parse(b.toString())

const PRICES: Record<string, number> = { 'acme-1': 34.99, 'acme-2': 15.0, 'acme-3': 24.5 }

const STATUS_LADDER = ['PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'] as const

const methodDef = (m: { name: string; requestStream: boolean; responseStream: boolean }): grpc.MethodDefinition<unknown, unknown> => ({
  path: `/acme.orders.OrderService/${m.name}`,
  requestStream: m.requestStream,
  responseStream: m.responseStream,
  requestSerialize: serialize,
  requestDeserialize: deserialize,
  responseSerialize: serialize,
  responseDeserialize: deserialize,
})

export const ORDER_SERVICE_DEFINITION: Record<string, unknown> = {
  PlaceOrder: methodDef({ name: 'PlaceOrder', requestStream: false, responseStream: false }),
  WatchOrder: methodDef({ name: 'WatchOrder', requestStream: false, responseStream: true }),
  SubmitOrders: methodDef({ name: 'SubmitOrders', requestStream: true, responseStream: false }),
  Chat: methodDef({ name: 'Chat', requestStream: true, responseStream: true }),
}

type EmitFrame = (channelId: string, frame: Omit<GrpcFrame, 'channelId' | 'timestamp'>) => void

/** The call context every server handler receives (unary/streams alike). */
type HandlerCall = grpc.ServerUnaryCall<unknown, unknown> &
  grpc.ServerReadableStream<unknown, unknown> &
  grpc.ServerWritableStream<unknown, unknown> &
  grpc.ServerDuplexStream<unknown, unknown>

let server: grpc.Server | null = null
let address = ''
let client: grpc.Client | null = null
const bidiCalls = new Map<string, { stream: grpc.ClientDuplexStream<unknown, unknown>; method: string }>()

type Order = Record<string, unknown>

const buildOrder = (items: unknown): Order => {
  const list = Array.isArray(items) ? items : []
  const total = list.reduce((acc: number, it: unknown) => {
    const { sku, quantity } = (it ?? {}) as { sku?: string; quantity?: number }
    return acc + (PRICES[sku ?? 'acme-1'] ?? 0) * (quantity ?? 1)
  }, 0)
  return {
    id: `ord_${Math.floor(1000 + Math.random() * 9000)}`,
    status: 'PROCESSING',
    total: Number(total.toFixed(2)),
    currency: 'USD',
    placed_at: new Date().toISOString(),
  }
}

function wireHandlers(): grpc.UntypedServiceImplementation {
  return {
    PlaceOrder: (call: HandlerCall, respond: (err: grpc.ServiceError | null, res?: unknown) => void) => {
      const req = (call.request ?? {}) as { customer_id?: string; items?: unknown }
      const order = buildOrder(req.items)
      const meta = call.metadata.get('x-vaynt-meta').join()
      respond(null, { ...order, echo_customer: req.customer_id ?? null, metadata: meta })
    },
    WatchOrder: (call: HandlerCall) => {
      const { order_id } = (call.request ?? {}) as { order_id?: string }
      STATUS_LADDER.forEach((status, i) => {
        setTimeout(() => {
          call.write({
            order_id,
            status,
            at: new Date(Date.now() + i * 260).toISOString(),
          })
          if (i === STATUS_LADDER.length - 1) call.end()
        }, 150 + i * 260)
      })
    },
    SubmitOrders: (call: HandlerCall, respond: (err: grpc.ServiceError | null, res?: unknown) => void) => {
      const items: unknown[] = []
      call.on('data', (chunk: unknown) => items.push(chunk))
      call.on('end', () => {
        const order = buildOrder(items)
        respond(null, { ...order, submitted_count: items.length })
      })
    },
    Chat: (call: HandlerCall) => {
      call.on('data', (chunk: unknown) => {
        const text = ((chunk ?? {}) as { text?: string }).text ?? ''
        call.write({ text: text.toUpperCase() })
      })
      call.on('end', () => call.end())
    },
  } as unknown as grpc.UntypedServiceImplementation
}

/** Start (once) the demo server on an ephemeral port; returns `host:port`. */
export async function ensureGrpcServer(): Promise<string> {
  if (server && address) return address
  const srv = new grpc.Server()
  srv.addService(ORDER_SERVICE_DEFINITION as grpc.ServiceDefinition, wireHandlers())
  await new Promise<string>((resolve, reject) => {
    srv.bindAsync('127.0.0.1:0', grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) return reject(err)
      server = srv
      address = `127.0.0.1:${port}`
      resolve(address)
    })
  })
  return address
}

/** Lazy grpc client that talks to the server from the same process. */
const getClient = (): grpc.Client => {
  if (!client) {
    const Generic = grpc.makeGenericClientConstructor(
      ORDER_SERVICE_DEFINITION as grpc.ServiceDefinition,
      'OrderService',
      {}
    )
    client = new Generic(address, grpc.credentials.createInsecure()) as unknown as grpc.Client
    appOnQuit(() => client!.close())
  }
  return client!
}

const toMetadata = (metadata?: GrpcMetadataArg[]): grpc.Metadata => {
  const md = new grpc.Metadata()
  for (const { key, value } of metadata ?? []) md.set(key, value)
  return md
}

type UnaryFn = (m: unknown, md: grpc.Metadata, cb: (err: grpc.ServiceError | null, res?: unknown) => void) => grpc.ClientUnaryCall
type ServerStreamFn = (m: unknown, md: grpc.Metadata) => grpc.ClientReadableStream<unknown>
type ClientStreamFn = (cb: (err: grpc.ServiceError | null, res?: unknown) => void) => grpc.ClientWritableStream<unknown>
type DuplexFn = () => grpc.ClientDuplexStream<unknown, unknown>

const resolveMethod = <T>(c: grpc.Client, method: string): T => {
  const fn = (c as unknown as Record<string, T | undefined>)[method]
  if (!fn) throw new Error(`Unknown gRPC method "${method}"`)
  return fn
}

/** Dispatches on `method` by name instead of hardcoding an RPC, so every
 * service method — not just the demo's one-per-kind set — actually resolves. */
const unaryMethod = (c: grpc.Client, method: string): UnaryFn => resolveMethod<UnaryFn>(c, method)
const serverStreamMethod = (c: grpc.Client, method: string): ServerStreamFn => resolveMethod<ServerStreamFn>(c, method)
const clientStreamMethod = (c: grpc.Client, method: string): ClientStreamFn => resolveMethod<ClientStreamFn>(c, method)
const duplexMethod = (c: grpc.Client, method: string): DuplexFn => resolveMethod<DuplexFn>(c, method)

/** Unary call — returns the server's response (or throws a readable error). */
export async function grpcUnary(
  channelId: string,
  method: string,
  message: unknown,
  metadata: GrpcMetadataArg[] | undefined,
  emit: EmitFrame
): Promise<{ message: unknown; status: string; durationMs: number }> {
  if (!address) throw new Error('gRPC server not started')
  const started = Date.now()
  const c = getClient()
  emit(channelId, { kind: 'started', method, message })
  return await new Promise((resolve, reject) => {
    unaryMethod(c, method)(message, toMetadata(metadata), (err, res) => {
      if (err) {
        emit(channelId, { kind: 'error', method, message: { code: err.code, message: err.message } })
        return reject(err)
      }
      emit(channelId, { kind: 'data', method, message: res })
      emit(channelId, { kind: 'status', method, text: 'OK' })
      resolve({ message: res, status: 'OK', durationMs: Date.now() - started })
    })
  })
}

/** Server-stream call — pushes each frame back through {@link emit}. */
export async function grpcServerStream(
  channelId: string,
  method: string,
  message: unknown,
  metadata: GrpcMetadataArg[] | undefined,
  emit: EmitFrame
): Promise<void> {
  if (!address) throw new Error('gRPC server not started')
  const c = getClient()
  emit(channelId, { kind: 'started', method, message })
  const stream = serverStreamMethod(c, method)(message, toMetadata(metadata))
  stream.on('data', (frame) => emit(channelId, { kind: 'data', method, message: frame }))
  stream.on('end', () => emit(channelId, { kind: 'end', method }))
  stream.on('error', (err) =>
    emit(channelId, { kind: 'error', method, message: { code: (err as { code?: number }).code, message: err.message } })
  )
}

/** Client-stream call — sends all queued messages, then resolves with the response. */
export async function grpcClientStream(
  channelId: string,
  method: string,
  messages: unknown[],
  metadata: GrpcMetadataArg[] | undefined,
  emit: EmitFrame
): Promise<{ message: unknown; status: string; durationMs: number }> {
  if (!address) throw new Error('gRPC server not started')
  const started = Date.now()
  const c = getClient()
  emit(channelId, { kind: 'started', method, message: messages })
  return await new Promise((resolve, reject) => {
    const call = clientStreamMethod(c, method)((err, res) => {
      if (err) {
        emit(channelId, { kind: 'error', method, message: { code: err.code, message: err.message } })
        return reject(err)
      }
      emit(channelId, { kind: 'data', method, message: res })
      emit(channelId, { kind: 'status', method, text: 'OK' })
      resolve({ message: res, status: 'OK', durationMs: Date.now() - started })
    })
    for (const m of messages) call.write(m)
    call.end()
  })
}

/** Open (or reuse) a bidi stream keyed by channelId; frames pushed via the callback. */
export async function grpcBidiStart(
  channelId: string,
  method: string,
  onBidiFrame: (frame: Omit<GrpcFrame, 'channelId' | 'timestamp'>) => void
): Promise<void> {
  if (!address) throw new Error('gRPC server not started')
  if (bidiCalls.has(channelId)) return
  const c = getClient()
  const stream = duplexMethod(c, method)()
  bidiCalls.set(channelId, { stream, method })
  stream.on('data', (frame) => onBidiFrame({ kind: 'data', method, message: frame }))
  stream.on('end', () => {
    onBidiFrame({ kind: 'end', method })
    bidiCalls.delete(channelId)
  })
  stream.on('error', (err) =>
    onBidiFrame({ kind: 'error', method, message: { code: (err as { code?: number }).code, message: err.message } })
  )
  onBidiFrame({ kind: 'started', method })
}

export async function grpcBidiSend(
  channelId: string,
  message: unknown,
  onBidiFrame: (frame: Omit<GrpcFrame, 'channelId' | 'timestamp'>) => void
): Promise<void> {
  const entry = bidiCalls.get(channelId)
  if (!entry) throw new Error('No active bidi stream for this tab')
  onBidiFrame({ kind: 'sent', method: entry.method, message })
  entry.stream.write(message)
}

export async function grpcBidiEnd(
  channelId: string,
  onBidiFrame: (frame: Omit<GrpcFrame, 'channelId' | 'timestamp'>) => void
): Promise<void> {
  const entry = bidiCalls.get(channelId)
  if (!entry) return
  entry.stream.end()
  onBidiFrame({ kind: 'end', method: entry.method })
  bidiCalls.delete(channelId)
}

/* ------------------------- process-lifecycle shelving ------------------------ */

type LifecycleHook = () => void
const lifecycleHooks: LifecycleHook[] = []
let lifecycleBound = false

function appOnQuit(hook: () => void): void {
  lifecycleHooks.push(hook)
  if (lifecycleBound) return
  lifecycleBound = true
  process.once('exit', () => {
    for (const h of lifecycleHooks) {
      try {
        h()
      } catch {
        /* ignore teardown errors */
      }
    }
  })
}