import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  createMockGrpcSession,
  createMockSse,
  createMockWebSocket,
  executeGraphQL,
  formatGraphQL,
  graphqlIntrospection,
} from '../src/index.ts'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/* --------------------------------- GraphQL -------------------------------- */

test('introspection exposes the Acme query and mutation surface', () => {
  const schema = graphqlIntrospection()
  const query = schema.types.find((t) => t.name === schema.queryType)
  assert.ok(query, 'query type present')
  assert.ok(query.fields.some((f) => f.name === 'users'), 'users field')
  assert.ok(query.fields.some((f) => f.name === 'orders'), 'orders field')
  assert.ok(query.fields.some((f) => f.name === 'payments'), 'payments field')
  const mutation = schema.types.find((t) => t.name === schema.mutationType)
  assert.ok(mutation, 'mutation type present')
  assert.ok(mutation.fields.some((f) => f.name === 'createOrder'), 'createOrder mutation')
  assert.ok(mutation.fields.some((f) => f.name === 'createUser'), 'createUser mutation')
})

test('executes a nested Users → Orders query with a real shaped response', () => {
  const res = executeGraphQL({
    query: `{ me { id name } users { id status } orders { id status items { sku quantity product { id name } } } }`,
  })
  assert.equal(res.handledByMock, true)
  assert.equal(res.errors, undefined)
  assert.ok(res.data)
  const orders = res.data['orders'] as { items: { sku: string; product: { name: string } }[] }[]
  assert.equal(orders.length, 3)
  assert.equal(orders[0]?.items.length, 2)
  assert.equal(orders[0]?.items[0]?.product.name, 'Wireless Charger')
})

test('applyable variables reach an operation selection', () => {
  const res = executeGraphQL({
    query: `query ($id: ID!) { order(id: $id) { id status } }`,
    variables: { id: 'ord_902' },
  })
  assert.equal(res.data?.['order']?.id, 'ord_902')
})

test('createOrder mutation resolves totals from its items argument', () => {
  const res = executeGraphQL({
    query: `mutation { createOrder(items: [{ sku: "acme-1", quantity: 2 }, { sku: "acme-2", quantity: 1 }]) { id status total currency } }`,
  })
  assert.equal(res.data?.['createOrder']?.status, 'PROCESSING')
  assert.equal(res.data?.['createOrder']?.total, 84.98)
  assert.equal(res.data?.['createOrder']?.currency, 'USD')
})

test('unknown fields produce a GraphQL error instead of a throw', () => {
  const res = executeGraphQL({ query: `{ bogus }` })
  assert.ok(res.errors, 'errors present')
  assert.ok((res.errors ?? [])[0]?.message.includes('bogus'))
})

test('formatGraphQL pretty-prints a minified document', () => {
  const out = formatGraphQL(`query GetUser{user(id:"u1"){id name}}`)
  assert.ok(out.startsWith('query GetUser'))
  assert.ok(out.includes('\n  user'))
  assert.ok(out.includes('\n    id'))
  assert.ok(out.includes('\n    name'))
})

test('formatGraphQL keeps argument paren groups inline with the field', () => {
  const out = formatGraphQL(`mutation { createOrder(items: [{ sku: "acme-1", quantity: 2 }]) { id } }`)
  assert.ok(out.includes('createOrder(items:'), 'paren args stay inline')
  assert.ok(out.includes('{ sku:'), 'object literal kept')
})

/* -------------------------------- WebSocket ------------------------------- */

test('mock websocket connects, streams peer frames, and echoes sends', async () => {
  const statuses: string[] = []
  const frames: { direction: string; payload: string }[] = []
  const ws = createMockWebSocket('ws://demo.vayntforge.dev/chat', {
    onStatus: (s) => statuses.push(s),
    onFrame: (f) => frames.push({ direction: f.direction, payload: f.payload }),
    onLog: () => undefined,
  })
  assert.equal(ws.handledByMock, true)
  await sleep(500)
  assert.ok(statuses.includes('connected'))
  assert.ok(frames.some((f) => f.direction === 'received'), 'peer sent frames')
  ws.send('{"hi":"there"}')
  await sleep(500)
  assert.ok(frames.some((f) => f.direction === 'sent' && f.payload.includes('there')))
  assert.ok(frames.some((f) => f.direction === 'received' && f.payload.includes('there')), 'echo returned')
  ws.close()
  await sleep(200)
  assert.equal(statuses[statuses.length - 1], 'closed')
})

/* ----------------------------------- SSE ----------------------------------- */

test('mock SSE opens, emits events, pauses, resumes, and closes', async () => {
  const events: string[] = []
  const statuses: string[] = []
  const sse = createMockSse('https://demo.vayntforge.dev/events', {
    onStatus: (s) => statuses.push(s),
    onEvent: (e) => events.push(e.event),
    onLog: () => undefined,
  })
  await sleep(400)
  assert.ok(statuses.includes('open'))
  const before = events.length
  assert.ok(before > 0, 'events flowing')
  sse.pause()
  const frozen = events.length
  await sleep(350)
  assert.equal(events.length, frozen, 'paused stops the stream')
  sse.resume()
  await sleep(350)
  assert.ok(events.length > frozen, 'resumed after pause')
  sse.close()
  await sleep(50)
  assert.equal(statuses[statuses.length - 1], 'closed')
})

/* ------------------------------- gRPC (mock) ------------------------------- */

test('mock gRPC unary call returns a plausible order and records both directions', async () => {
  const g = createMockGrpcSession()
  const res = await g.unary('PlaceOrder', { customer_id: 'usr_1' })
  assert.equal(res.status, 'OK')
  assert.equal((res.message as { order: { id: string } }).order.id, 'ord_901')
  assert.equal(g.calls.some((c) => c.dir === 'sent' && c.method === 'PlaceOrder'), true)
  assert.equal(g.calls.some((c) => c.dir === 'received'), true)
})

test('mock gRPC server-stream pushes lifecycle frames and client-stream reports progress', async () => {
  const g = createMockGrpcSession()
  const received: unknown[] = []
  g.serverStream('WatchOrder', { order_id: 'ord_902' }, (m) => received.push(m))
  await sleep(1200)
  assert.ok(received.length >= 4, `expected >=4 frames, got ${received.length}`)

  const progress: number[] = []
  const batch = await g.clientStream(
    'SubmitOrders',
    [{ sku: 'acme-1', quantity: 1 }, { sku: 'acme-2', quantity: 1 }],
    (i, total) => progress.push(i)
  )
  assert.equal(batch.status, 'OK')
  assert.equal(progress.length, 2)
})