/**
 * Sprint 9 — real-time protocol types. Engine is Electron-free and pure TS:
 * the WebSocket, SSE, and gRPC mock clients here are simulation modules
 * (timers + canned data), mirroring `MockRequestClient`. The actual
 * `@grpc/grpc-js` server lives in the desktop main process; this package only
 * defines the shared descriptors, frame shapes, and mock behaviour.
 */

/** Which real-time protocol a workspace tab speaks. */
export type RealtimeProtocol = 'graphql' | 'ws' | 'sse' | 'grpc'

/** Sprint 11 — request-analysis workspace tools (not live protocols). */
export type AnalysisTool = 'debugger' | 'compare'

/** Union of tab kinds — `http` is the classic request-builder tab. */
export type TabKind = 'http' | RealtimeProtocol | AnalysisTool

/** Every mock real-time fixture is tagged so the UI can label it. */
export interface MockTagged {
  handledByMock: true
}

/* -------------------------------------------------------------------------- *
 * WebSocket
 * -------------------------------------------------------------------------- */

export type WsStatus = 'idle' | 'connecting' | 'connected' | 'closing' | 'closed'

export type WsMessageFormat = 'json' | 'text' | 'base64'

export type WsDirection = 'sent' | 'received'

export interface WsFrame {
  id: string
  direction: WsDirection
  format: WsMessageFormat
  /** Human-readable payload (already decoded for binary/base64). */
  payload: string
  /** Raw byte length of the frame payload. */
  size: number
  timestamp: number
}

export interface WsHandlers {
  onStatus(status: WsStatus): void
  onFrame(frame: WsFrame): void
  onLog(line: string): void
}

export interface MockWsSession extends MockTagged {
  readonly status: WsStatus
  send(text: string, format?: WsMessageFormat): void
  ping(): void
  reconnect(): void
  close(): void
}

/** Pushed main→renderer over `IPC.WS_EVENT` by the real `ws`-backed connection in the main process, routed by channelId (the tab id). */
export type WsPushEvent =
  | { kind: 'status'; status: WsStatus }
  | { kind: 'frame'; frame: WsFrame }
  | { kind: 'log'; line: string }

/* -------------------------------------------------------------------------- *
 * Server-Sent Events
 * -------------------------------------------------------------------------- */

export type SseStatus = 'idle' | 'connecting' | 'open' | 'paused' | 'closed'

export interface SseEvent {
  id: string
  event: string
  data: string
  timestamp: number
  retry?: number
}

export interface SseHandlers {
  onStatus(status: SseStatus): void
  onEvent(event: SseEvent): void
  onLog(line: string): void
}

export interface MockSseSession extends MockTagged {
  readonly status: SseStatus
  readonly paused: boolean
  pause(): void
  resume(): void
  close(): void
  reconnect(): void
}

/** Pushed main→renderer over `IPC.SSE_EVENT` by the real fetch-stream connection in the main process, routed by channelId (the tab id). */
export type SsePushEvent =
  | { kind: 'status'; status: SseStatus }
  | { kind: 'event'; event: SseEvent }
  | { kind: 'log'; line: string }

/* -------------------------------------------------------------------------- *
 * GraphQL
 * -------------------------------------------------------------------------- */

export interface GraphQLFieldDef {
  name: string
  /** Renderable type string, e.g. `User!`, `[Order!]!`, `String`. */
  type: string
  description?: string
  args?: GraphQLFieldDef[]
}

export interface GraphQLObjectType {
  kind: 'object'
  name: string
  description?: string
  fields: GraphQLFieldDef[]
  interfaces?: string[]
}

export interface GraphQLEnumType {
  kind: 'enum'
  name: string
  description?: string
  values: { name: string; description?: string }[]
}

export interface GraphQLScalarType {
  kind: 'scalar'
  name: string
  description?: string
}

export type GraphQLTypeRef = GraphQLObjectType | GraphQLEnumType | GraphQLScalarType

/** Distilled schema model — what the schema explorer renders. */
export interface GraphQLSchemaModel {
  queryType: string
  mutationType?: string
  subscriptionType?: string
  types: GraphQLTypeRef[]
}

export interface GraphQLError {
  message: string
  path?: string[]
}

export interface GraphQLExecutionResult extends MockTagged {
  data?: Record<string, unknown>
  errors?: GraphQLError[]
  /** Echoed endpoint + variables so the panel can show what ran. */
  endpoint?: string
}

/* -------------------------------------------------------------------------- *
 * gRPC
 * -------------------------------------------------------------------------- */

export type GrpcMethodKind = 'unary' | 'server-stream' | 'client-stream' | 'bidi-stream'

export interface GrpcMethod {
  name: string
  fullName: string
  kind: GrpcMethodKind
  requestType: string
  responseType: string
  description?: string
}

export interface GrpcService {
  name: string
  fullName: string
  methods: GrpcMethod[]
}

/** Plain-object descriptors sent over IPC (no Map/class protos). */
export interface GrpcMetadataArg {
  key: string
  value: string
}

export interface GrpcCallArg {
  /** Renderer tab id — used as the frame routing channel. */
  channelId: string
  method: string
  message?: unknown
  messages?: unknown[]
  metadata?: GrpcMetadataArg[]
}

export type GrpcFrameKind =
  | 'ready'
  | 'data'
  | 'end'
  | 'error'
  | 'started'
  | 'sent'
  | 'status'

export interface GrpcFrame {
  channelId: string
  kind: GrpcFrameKind
  method: string
  message?: unknown
  text?: string
  timestamp: number
}

export interface GrpcUnaryResult extends MockTagged {
  message: unknown
  status: string
  durationMs: number
}

export interface GrpcStreamResult extends MockTagged {
  count: number
  status: string
  durationMs: number
}