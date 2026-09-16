import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { GrpcReflection } from 'grpc-js-reflection-client'
import { DEMO_GRPC_SERVICE, DEMO_PROTO } from '@vayntforge/engine'
import type { GrpcFrame, GrpcMetadataArg, GrpcMethodKind, GrpcService } from '@vayntforge/engine'

/**
 * Sprint 9 — the in-app gRPC demo server. Sprint 15 — real external targets:
 * a renderer tab can point at any real `host:port` gRPC service, discovered
 * either via server reflection (`grpc.reflection.v1alpha.ServerReflection`,
 * through `grpc-js-reflection-client`) or a user-supplied `.proto` file
 * (`@grpc/proto-loader`). Both paths resolve to a real protobuf
 * `grpc.ServiceDefinition` fed into `grpc.makeGenericClientConstructor` —
 * exactly what already backed the JSON-wire demo server, so the existing
 * unary/stream/bidi call plumbing below needed no changes, only a real
 * per-channel client instead of one hardcoded singleton.
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
const bidiCalls = new Map<string, { stream: grpc.ClientDuplexStream<unknown, unknown>; method: string }>()

/** One real client per renderer tab (channelId), pointed at whatever target that tab connected to (demo server or external). */
const targets = new Map<string, { client: grpc.Client }>()

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

function closeClient(client: grpc.Client): void {
  try {
    client.close()
  } catch {
    /* already closed */
  }
}

/** Loader options that make every real target's messages plain JS objects — same shape the JSON demo wire already used. */
const LOADER_OPTS: protoLoader.Options = { keepCase: true, longs: String, enums: String, defaults: true, oneofs: true }

/** True when a proto-loader package-definition entry is a service (a map of methods), not a message/enum type descriptor. */
function isServiceDefinitionEntry(def: unknown): def is grpc.ServiceDefinition {
  if (!def || typeof def !== 'object') return false
  const values = Object.values(def as Record<string, unknown>)
  if (values.length === 0) return false
  return values.every((v) => v !== null && typeof v === 'object' && 'path' in (v as object) && 'originalName' in (v as object))
}

/** Splits a `PackageDefinition` into browsable {@link GrpcService} descriptors and one flat, name-keyed `ServiceDefinition` for the generic client (matches this app's existing name-based method dispatch). */
function describeServices(packageDefinition: protoLoader.PackageDefinition): { services: GrpcService[]; merged: grpc.ServiceDefinition } {
  const merged: grpc.ServiceDefinition = {}
  const services: GrpcService[] = []
  for (const [fullName, def] of Object.entries(packageDefinition)) {
    if (!isServiceDefinitionEntry(def)) continue
    const shortName = fullName.split('.').pop() ?? fullName
    const methods = Object.entries(def).map(([methodName, methodDefEntry]) => {
      const kind: GrpcMethodKind = methodDefEntry.requestStream
        ? methodDefEntry.responseStream
          ? 'bidi-stream'
          : 'client-stream'
        : methodDefEntry.responseStream
          ? 'server-stream'
          : 'unary'
      const reqType = (methodDefEntry as { requestType?: { type?: { name?: string } } }).requestType?.type?.name
      const resType = (methodDefEntry as { responseType?: { type?: { name?: string } } }).responseType?.type?.name
      return {
        name: methodName,
        fullName: `${fullName}/${methodName}`,
        kind,
        requestType: reqType ?? 'Request',
        responseType: resType ?? 'Response',
      }
    })
    services.push({ name: shortName, fullName, methods })
    Object.assign(merged, def)
  }
  return { services, merged }
}

/** Names emitted by reflection that describe the reflection/health machinery itself, not the target's own API. */
const REFLECTION_NOISE = new Set([
  'grpc.reflection.v1alpha.ServerReflection',
  'grpc.reflection.v1.ServerReflection',
  'grpc.health.v1.Health',
])

export interface GrpcConnectResult {
  services: GrpcService[]
  protoSource?: string
}

/** Starts (or reuses) the demo server, builds a real client for it, and returns its address + descriptors. */
export async function grpcConnectDemo(channelId: string): Promise<{ address: string } & GrpcConnectResult> {
  const addr = await ensureGrpcServer()
  const prev = targets.get(channelId)
  if (prev) closeClient(prev.client)
  const Ctor = grpc.makeGenericClientConstructor(ORDER_SERVICE_DEFINITION as grpc.ServiceDefinition, 'OrderService', {})
  const client = new Ctor(addr, grpc.credentials.createInsecure()) as unknown as grpc.Client
  targets.set(channelId, { client })
  return { address: addr, services: [DEMO_GRPC_SERVICE], protoSource: DEMO_PROTO }
}

/**
 * Connects to a real external `host:port` gRPC target — via a supplied
 * `.proto` file, or (when omitted) server reflection. Either path resolves to
 * a real `grpc.ServiceDefinition`; all discovered services are flattened into
 * one client since existing call dispatch resolves methods by bare name.
 */
export async function grpcConnectExternal(
  channelId: string,
  address: string,
  tls: boolean,
  protoPath?: string
): Promise<GrpcConnectResult> {
  const credentials = tls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()

  let services: GrpcService[]
  let merged: grpc.ServiceDefinition
  let protoSource: string | undefined

  if (protoPath) {
    const packageDefinition = protoLoader.loadSync(protoPath, { ...LOADER_OPTS, includeDirs: [path.dirname(protoPath)] })
    ;({ services, merged } = describeServices(packageDefinition))
    protoSource = readFileSync(protoPath, 'utf8')
  } else {
    const reflectionClient = new GrpcReflection(address, credentials)
    const symbols = await reflectionClient.listServices()
    const targetSymbols = symbols.filter((s) => !REFLECTION_NOISE.has(s))
    if (targetSymbols.length === 0) {
      throw new Error('Server reflection returned no services — is reflection enabled on this target, or does it need a .proto file instead?')
    }
    services = []
    merged = {}
    for (const symbol of targetSymbols) {
      const descriptor = await reflectionClient.getDescriptorBySymbol(symbol)
      const described = describeServices(descriptor.getPackageDefinition(LOADER_OPTS))
      services.push(...described.services)
      Object.assign(merged, described.merged)
    }
  }

  if (services.length === 0) {
    throw new Error(protoPath ? 'No services found in that .proto file' : 'No services found')
  }

  const Ctor = grpc.makeGenericClientConstructor(merged, 'ExternalService', {})
  const client = new Ctor(address, credentials) as unknown as grpc.Client
  const prev = targets.get(channelId)
  if (prev) closeClient(prev.client)
  targets.set(channelId, { client })

  return { services, protoSource }
}

/** Disconnects and forgets this tab's target — closes the real client and ends any open bidi stream. */
export function grpcDisconnect(channelId: string): void {
  const t = targets.get(channelId)
  if (t) {
    closeClient(t.client)
    targets.delete(channelId)
  }
  const bidi = bidiCalls.get(channelId)
  if (bidi) {
    try {
      bidi.stream.end()
    } catch {
      /* already ended */
    }
    bidiCalls.delete(channelId)
  }
}

function getClient(channelId: string): grpc.Client {
  const t = targets.get(channelId)
  if (!t) throw new Error('Not connected — start the demo server or connect to a target first')
  return t.client
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

const resolveMethod = <T extends (...args: never[]) => unknown>(c: grpc.Client, method: string): T => {
  const fn = (c as unknown as Record<string, T | undefined>)[method]
  if (!fn) throw new Error(`Unknown gRPC method "${method}"`)
  // grpc-js's generated client methods read `this` (e.g. this.makeUnaryRequest) —
  // extracting the function by name detaches it, so it must be rebound to `c`.
  return fn.bind(c) as T
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
  const started = Date.now()
  const c = getClient(channelId)
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
  const c = getClient(channelId)
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
  const started = Date.now()
  const c = getClient(channelId)
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
  if (bidiCalls.has(channelId)) return
  const c = getClient(channelId)
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
