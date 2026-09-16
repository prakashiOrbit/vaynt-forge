import type {
  GrpcMethodKind,
  GrpcService,
  MockTagged,
} from './types.js'

/**
 * Sprint 9 — demo gRPC descriptors + a mock client. The descriptors describe
 * the same `acme.orders.OrderService` that the in-app `@grpc/grpc-js` mock
 * server hosts (see apps/desktop/src/main/grpcServer.ts), so the proto view,
 * services tree, and the real call stubs all agree. The mock client exists so
 * the workspace remains interactive even before/without the real server.
 */

export const DEMO_PROTO = `syntax = "proto3";

package acme.orders;

// The demo ordering service hosted by Vaynt Forge's in-app gRPC mock server.
service OrderService {
  // Place an order and get an order id back.
  rpc PlaceOrder(PlaceOrderRequest) returns (Order) {}
  // Subscribe to an order's lifecycle transitions.
  rpc WatchOrder(WatchOrderRequest) returns (stream OrderStatus) {}
  // Submit a batch of line items, then get the final order.
  rpc SubmitOrders(stream OrderItem) returns (Order) {}
  // Bidirectional echo chat (upper-cases each line).
  rpc Chat(stream ChatMessage) returns (stream ChatMessage) {}
}

message PlaceOrderRequest {
  string customer_id = 1;
  repeated OrderItem items = 2;
}

message WatchOrderRequest {
  string order_id = 1;
}

message OrderItem {
  string sku = 1;
  int32 quantity = 2;
}

message Order {
  string id = 1;
  string status = 2;
  double total = 3;
  string currency = 4;
  int64 placed_at = 5;
}

message OrderStatus {
  string order_id = 1;
  string status = 2;
  string at = 3;
}

message ChatMessage {
  string text = 1;
}
`

const method = (
  name: string,
  kind: GrpcMethodKind,
  requestType: string,
  responseType: string,
  description?: string
): GrpcService['methods'][number] => ({
  name,
  fullName: `acme.orders.OrderService/${name}`,
  kind,
  requestType,
  responseType,
  description,
})

export const DEMO_GRPC_SERVICE: GrpcService = {
  name: 'OrderService',
  fullName: 'acme.orders.OrderService',
  methods: [
    method('PlaceOrder', 'unary', 'PlaceOrderRequest', 'Order', 'Place an order and get an order id back.'),
    method('WatchOrder', 'server-stream', 'WatchOrderRequest', 'Stream<OrderStatus>', 'Subscribe to an order’s lifecycle transitions.'),
    method('SubmitOrders', 'client-stream', 'Stream<OrderItem>', 'Order', 'Submit a batch of line items, then get the final order.'),
    method('Chat', 'bidi-stream', 'Stream<ChatMessage>', 'Stream<ChatMessage>', 'Bidirectional echo chat (upper-cases each line).'),
  ],
}

export function grpcIntrospection(): GrpcService[] {
  return [DEMO_GRPC_SERVICE]
}

export interface MockGrpcCall {
  method: string
  message: unknown
  timestamp: number
  dir: 'sent' | 'received'
  status?: string
}

export interface MockGrpcSession extends MockTagged {
  readonly calls: MockGrpcCall[]
  unary(method: string, message: unknown): Promise<{ message: unknown; status: string; durationMs: number }>
  serverStream(method: string, message: unknown, onMessage: (m: unknown) => void): void
  clientStream(method: string, messages: unknown[], onProgress?: (i: number, total: number) => void): Promise<{ message: unknown; status: string }>
  bidiStart(method: string, onMessage: (m: unknown) => void): void
  bidiSend(message: unknown): void
  bidiEnd(): void
}

// Simple reference product/order table so mocked replies look plausible.
const mockReply = (method: string, input: unknown): unknown => {
  const msg = (input ?? {}) as Record<string, unknown>
  switch (method) {
    case 'PlaceOrder': {
      const total = 84.98
      return {
        order: { id: 'ord_901', status: 'PROCESSING', total, currency: 'USD' },
        echo: msg,
      }
    }
    case 'WatchOrder': {
      return msg
    }
    case 'SubmitOrders': {
      return { order: { id: 'ord_902', status: 'COMPLETED' }, count: Array.isArray(msg['messages']) ? msg['messages'].length : 1 }
    }
    case 'Chat': {
      const text = typeof msg['text'] === 'string' ? msg['text'] : ''
      return { text: text.toUpperCase() }
    }
    default: {
      return { ok: true, method }
    }
  }
}

export function createMockGrpcSession(): MockGrpcSession {
  const calls: MockGrpcCall[] = []

  const record = (dir: 'sent' | 'received', method: string, message: unknown): void => {
    calls.push({ dir, method, message, timestamp: Date.now() })
  }

  return {
    calls,
    handledByMock: true,
    async unary(method, message) {
      const started = Date.now()
      record('sent', method, message)
      await new Promise((r) => setTimeout(r, 140 + Math.random() * 120))
      const reply = mockReply(method, message)
      record('received', method, reply)
      return { message: reply, status: 'OK', durationMs: Date.now() - started }
    },
    serverStream(method, message, onMessage) {
      record('sent', method, message)
      Promise.resolve()
        .then(() => new Promise((r) => setTimeout(r, 120)))
        .then(() => {
          for (let i = 0; i < 4; i++) {
            setTimeout(() => {
              const status = ['PROCESSING', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED'][i]
              const frame = { order_id: (message as Record<string, unknown>)['order_id'], status, at: new Date().toISOString() }
              record('received', method, frame)
              onMessage(frame)
            }, i * 260)
          }
        })
        .catch(() => undefined)
    },
    async clientStream(method, messages, onProgress) {
      messages.forEach((m, i) => {
        record('sent', method, m)
        onProgress?.(i + 1, messages.length)
      })
      await new Promise((r) => setTimeout(r, 180))
      const reply = mockReply(method, { messages })
      record('received', method, reply)
      return { message: reply, status: 'OK' }
    },
    bidiStart(method, onMessage) {
      void method
      void onMessage
    },
    bidiSend(message) {
      record('sent', 'Chat', message)
    },
    bidiEnd() {
      void 0
    },
  }
}