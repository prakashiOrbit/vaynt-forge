import { generateId } from '../util/id.js'
import type {
  GraphQLError,
  GraphQLExecutionResult,
  GraphQLFieldDef,
  GraphQLObjectType,
  GraphQLSchemaModel,
  GraphQLTypeRef,
} from './types.js'

/**
 * Sprint 9 — a small but genuine GraphQL engine: a demo schema model, an
 * introspection-shaped distiller for the schema explorer, a real field
 * resolver that walks parsed selection sets, and a brace-balanced
 * pretty-printer. The demo datasource mirrors the Acme API seed (users,
 * orders, payments) so the workspace stays internally consistent.
 */

function tk(tokens: readonly Token[], i: number): Token {
  const t = tokens[i]
  if (!t) throw new Error(`Unexpected end of token stream at index ${i}`)
  return t
}

/* ----------------------------- demo datasource ---------------------------- */

interface DemoUser {
  id: string
  name: string
  email: string
  status: 'active' | 'inactive'
}

interface DemoOrderItem {
  sku: string
  quantity: number
  product: { id: string; name: string; price: number }
}

interface DemoOrder {
  id: string
  status: string
  total: number
  currency: string
  items: DemoOrderItem[]
  placedAt: string
}

interface DemoPayment {
  id: string
  status: 'succeeded' | 'failed' | 'pending'
  amount: number
  method: string
  orderId: string
}

const USERS: DemoUser[] = [
  { id: 'usr_1024', name: 'Sarah Chen', email: 'sarah.chen@acme.dev', status: 'active' },
  { id: 'usr_1025', name: 'Michael Ross', email: 'michael.ross@acme.dev', status: 'active' },
  { id: 'usr_1026', name: 'Priya Patel', email: 'priya.patel@acme.dev', status: 'inactive' },
]

const PRODUCTS = [
  { id: 'acme-1', name: 'Wireless Charger', price: 34.99 },
  { id: 'acme-2', name: 'USB-C Cable', price: 15.0 },
  { id: 'acme-3', name: 'Desk Stand', price: 24.5 },
]

const ORDERS: DemoOrder[] = [
  {
    id: 'ord_901',
    status: 'PENDING',
    total: 84.98,
    currency: 'USD',
    placedAt: '2026-09-01T09:12:00Z',
    items: [
      { sku: 'acme-1', quantity: 2, product: PRODUCTS[0]! },
      { sku: 'acme-2', quantity: 1, product: PRODUCTS[1]! },
    ],
  },
  {
    id: 'ord_902',
    status: 'PROCESSING',
    total: 49.99,
    currency: 'USD',
    placedAt: '2026-09-02T14:30:00Z',
    items: [{ sku: 'acme-3', quantity: 1, product: PRODUCTS[2]! }],
  },
  {
    id: 'ord_903',
    status: 'DELIVERED',
    total: 124.48,
    currency: 'USD',
    placedAt: '2026-08-28T11:00:00Z',
    items: [
      { sku: 'acme-1', quantity: 2, product: PRODUCTS[0]! },
      { sku: 'acme-2', quantity: 4, product: PRODUCTS[1]! },
    ],
  },
]

const PAYMENTS: DemoPayment[] = [
  { id: 'pay_501', status: 'succeeded', amount: 84.98, method: 'visa', orderId: 'ord_901' },
  { id: 'pay_502', status: 'pending', amount: 49.99, method: 'amex', orderId: 'ord_902' },
  { id: 'pay_503', status: 'failed', amount: 124.48, method: 'visa', orderId: 'ord_903' },
]

/* ------------------------------- schema model ----------------------------- */

const scalar = (name: string, description?: string): GraphQLTypeRef => ({
  kind: 'scalar',
  name,
  description,
})

const FIELD = (name: string, type: string, description?: string, args?: GraphQLFieldDef[]): GraphQLFieldDef =>
  ({ name, type, description, args })

const USER_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'User',
  description: 'A user account in the Acme workspace.',
  fields: [
    FIELD('id', 'ID!'),
    FIELD('name', 'String!'),
    FIELD('email', 'String!'),
    FIELD('status', 'UserStatus!'),
    FIELD('orders', '[Order!]!', 'Orders placed by this user (mocked to the same dataset).'),
  ],
}

const PRODUCT_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Product',
  fields: [FIELD('id', 'ID!'), FIELD('name', 'String!'), FIELD('price', 'Float!')],
}

const ORDER_ITEM_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'OrderItem',
  fields: [
    FIELD('sku', 'String!'),
    FIELD('quantity', 'Int!'),
    FIELD('product', 'Product!'),
  ],
}

const ORDER_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Order',
  description: 'An order placed through the Acme API.',
  fields: [
    FIELD('id', 'ID!'),
    FIELD('status', 'OrderStatus!'),
    FIELD('total', 'Float!'),
    FIELD('currency', 'String!'),
    FIELD('placedAt', 'String!'),
    FIELD('items', '[OrderItem!]!'),
  ],
}

const PAYMENT_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Payment',
  fields: [
    FIELD('id', 'ID!'),
    FIELD('status', 'PaymentStatus!'),
    FIELD('amount', 'Float!'),
    FIELD('method', 'String!'),
    FIELD('orderId', 'ID!'),
  ],
}

const HEALTH_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Health',
  fields: [
    FIELD('ok', 'Boolean!'),
    FIELD('service', 'String!'),
    FIELD('version', 'String!'),
  ],
}

const QUERY_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Query',
  fields: [
    FIELD('me', 'User!', 'The current user.'),
    FIELD('user', 'User', 'Lookup a single user by id.', [
      { name: 'id', type: 'ID!' },
    ]),
    FIELD('users', '[User!]!', 'Every user in the workspace.'),
    FIELD('order', 'Order', 'Lookup a single order by id.', [
      { name: 'id', type: 'ID!' },
    ]),
    FIELD('orders', '[Order!]!', 'Every order in the workspace.'),
    FIELD('payment', 'Payment', 'Lookup a single payment by id.', [
      { name: 'id', type: 'ID!' },
    ]),
    FIELD('payments', '[Payment!]!'),
    FIELD('health', 'Health!'),
  ],
}

const MUTATION_TYPE: GraphQLObjectType = {
  kind: 'object',
  name: 'Mutation',
  fields: [
    FIELD(
      'createUser',
      'User',
      'Create a user account.',
      [
        { name: 'name', type: 'String!' },
        { name: 'email', type: 'String!' },
      ]
    ),
    FIELD(
      'createOrder',
      'Order',
      'Place a new order.',
      [{ name: 'items', type: '[OrderItemInput!]!' }]
    ),
    FIELD(
      'createPayment',
      'Payment',
      'Charge an order.',
      [
        { name: 'orderId', type: 'ID!' },
        { name: 'amount', type: 'Float!' },
      ]
    ),
  ],
}

const USER_STATUS_ENUM: GraphQLTypeRef = {
  kind: 'enum',
  name: 'UserStatus',
  values: [
    { name: 'active' },
    { name: 'inactive' },
  ],
}

const ORDER_STATUS_ENUM: GraphQLTypeRef = {
  kind: 'enum',
  name: 'OrderStatus',
  values: [
    { name: 'PENDING' },
    { name: 'PROCESSING' },
    { name: 'SHIPPED' },
    { name: 'DELIVERED' },
    { name: 'CANCELLED' },
  ],
}

const PAYMENT_STATUS_ENUM: GraphQLTypeRef = {
  kind: 'enum',
  name: 'PaymentStatus',
  values: [
    { name: 'succeeded' },
    { name: 'pending' },
    { name: 'failed' },
  ],
}

const ORDER_ITEM_INPUT: GraphQLTypeRef = {
  kind: 'object',
  name: 'OrderItemInput',
  fields: [FIELD('sku', 'String!'), FIELD('quantity', 'Int!')],
}

const DEMO_SCHEMA: GraphQLSchemaModel = {
  queryType: 'Query',
  mutationType: 'Mutation',
  types: [
    QUERY_TYPE,
    MUTATION_TYPE,
    USER_TYPE,
    ORDER_TYPE,
    ORDER_ITEM_TYPE,
    PRODUCT_TYPE,
    PAYMENT_TYPE,
    ORDER_ITEM_INPUT,
    HEALTH_TYPE,
    USER_STATUS_ENUM,
    ORDER_STATUS_ENUM,
    PAYMENT_STATUS_ENUM,
    scalar('String'),
    scalar('Int'),
    scalar('Float'),
    scalar('Boolean'),
    scalar('ID'),
  ],
}

/** Schema model the explorer renders — the demo Acme GraphQL schema. */
export function graphqlIntrospection(): GraphQLSchemaModel {
  return DEMO_SCHEMA
}

/* --------------------------- query lexing/parsing ------------------------- */

type TokenType = 'name' | 'string' | 'number' | 'bool' | 'punct' | 'spread'

interface Token {
  type: TokenType
  value: string
  line: number
}

/** A scalar, list, or object literal value parsed out of a query's arguments. */
export type ArgValue =
  | string
  | number
  | boolean
  | null
  | ArgValue[]
  | { [key: string]: ArgValue }

interface Sel {
  name: string
  alias?: string
  args: Record<string, ArgValue>
  sub: Sel[] | null
  /** Named/inline spreads — flattened into `sub` at parse time. */
  fragmentNames: string[]
  inlineFragments: { typeName: string; sub: Sel[] }[]
}

function tokenize(source: string): { tokens: Token[]; error?: string } {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  const src = source

  while (i < src.length) {
    const ch = src.charAt(i)
    if (ch === '\n') {
      line++
      i++
      continue
    }
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === ',') {
      i++
      continue
    }
    if (source.startsWith('#', i)) {
      while (i < src.length && src.charAt(i) !== '\n') i++
      continue
    }
    if (ch === '"') {
      let j = i + 1
      let value = ''
      while (j < src.length && src.charAt(j) !== '"') {
        if (src.charAt(j) === '\\' && j + 1 < src.length) {
          value += src.charAt(j + 1) === 'n' ? '\n' : src.charAt(j + 1)
          j += 2
        } else {
          value += src.charAt(j)
          j++
        }
      }
      if (j >= src.length) return { tokens: [], error: `Unterminated string at line ${line}` }
      tokens.push({ type: 'string', value, line })
      i = j + 1
      continue
    }
    if (ch === '.') {
      if (src.slice(i, i + 3) === '...') {
        tokens.push({ type: 'spread', value: '...', line })
        i += 3
        continue
      }
      return { tokens: [], error: `Unexpected '.' at line ${line}` }
    }
    if (/[0-9-]/.test(ch)) {
      let j = i
      while (j < src.length && /[0-9.-]/.test(src.charAt(j))) j++
      tokens.push({ type: 'number', value: src.slice(i, j), line })
      i = j
      continue
    }
    if (/[A-Za-z_$]/.test(ch)) {
      let j = i
      while (j < src.length && /[A-Za-z0-9_$]/.test(src.charAt(j))) j++
      const word = src.slice(i, j)
      if (word === 'true' || word === 'false') tokens.push({ type: 'bool', value: word, line })
      else tokens.push({ type: 'name', value: word, line })
      i = j
      continue
    }
    if ('{}()[]:!@'.includes(ch)) {
      tokens.push({ type: 'punct', value: ch, line })
      i++
      continue
    }
    return { tokens: [], error: `Unexpected character '${ch}' at line ${line}` }
  }
  return { tokens }
}

/** Keeps the top-level operation; returns the operation name for callout text. */
function parseOperation(tokens: Token[]): { operation: string; error?: string } {
  if (tokens.length === 0) return { operation: tokens.length === 0 ? 'idle' : '', error: 'Query is empty' }
  const first = tk(tokens, 0)
  const op = first.value === 'query' || first.value === 'mutation' || first.value === 'subscription' ? first.value : 'query'
  let open = -1
  let depth = 0
  for (let i = 0; i < tokens.length; i++) {
    if (tk(tokens, i).type === 'punct' && tk(tokens, i).value === '{') {
      if (depth === 0) open = i
      depth++
    } else if (tk(tokens, i).type === 'punct' && tk(tokens, i).value === '}') {
      depth--
    }
  }
  if (open < 0) return { operation: 'idle', error: 'No selection set found on "' + op + '"' }

  const head = tokens.slice(0, open)
  let opName = ''
  if (head[0]?.value === op && head[1]?.type === 'name') opName = head[1].value

  return { operation: opName ? `${op} ${opName}` : op }
}

/**
 * Parse the document into (a) named fragments and (b) the root selection set,
 * with spreads inlined (they're pre-collected, so resolution is one pass).
 * Returns a GraphQL-style error string on syntax failure.
 */
function parseDocument(
  tokens: Token[]
): { selection: Sel[]; fragments: Record<string, Sel[]>; error?: string } {
  const fragments: Record<string, Sel[]> = {}

  /* Reads one complete value: scalar, enum name, list, or object literal. */
  const readValue = (i: number): { value: ArgValue; next: number; error?: string } => {
    const t = tk(tokens, i)
    if (!t) return { value: null, next: i, error: 'Unexpected end of input' }
    if (t.type === 'string') return { value: t.value, next: i + 1 }
    if (t.type === 'number') return { value: Number(t.value), next: i + 1 }
    if (t.type === 'bool') return { value: t.value === 'true', next: i + 1 }
    if (t.type === 'name') {
      if (t.value === 'null') return { value: null, next: i + 1 }
      return { value: t.value, next: i + 1 }
    }
    if (t.type === 'punct' && t.value === '[') {
      const list: ArgValue[] = []
      let j = i + 1
      while (j < tokens.length && !(tk(tokens, j).type === 'punct' && tk(tokens, j).value === ']')) {
        if (tk(tokens, j).type === 'punct' && tk(tokens, j).value === ',') {
          j++
          continue
        }
        const r = readValue(j)
        if (r.error) return { value: [], next: j, error: r.error }
        list.push(r.value)
        j = r.next
      }
      if (j >= tokens.length) return { value: [], next: j, error: 'Unterminated list value' }
      return { value: list, next: j + 1 }
    }
    if (t.type === 'punct' && t.value === '{') {
      const obj: Record<string, ArgValue> = {}
      let j = i + 1
      while (j < tokens.length && !(tk(tokens, j).type === 'punct' && tk(tokens, j).value === '}')) {
        if (tk(tokens, j).type === 'punct' && tk(tokens, j).value === ',') {
          j++
          continue
        }
        const keyTok = tk(tokens, j)
        if (keyTok?.type !== 'name' || tk(tokens, j + 1)?.type !== 'punct' || tk(tokens, j + 1)?.value !== ':') {
          return { value: {}, next: j, error: `Bad object key at line ${keyTok?.line ?? '?'}` }
        }
        const r = readValue(j + 2)
        if (r.error) return { value: {}, next: j, error: r.error }
        obj[keyTok.value] = r.value
        j = r.next
      }
      if (j >= tokens.length) return { value: {}, next: j, error: 'Unterminated object value' }
      return { value: obj, next: j + 1 }
    }
    return { value: null, next: i, error: `Unexpected token at line ${t.line ?? '?'}` }
  }

  const parseSelectionSet = (start: number, seen = new Set<string>()): { sel: Sel[]; next: number; error?: string } => {
    if (tk(tokens, start)?.type !== 'punct' || tk(tokens, start).value !== '{') {
      return { sel: [], next: start, error: `Expected '{' at line ${tk(tokens, start)?.line ?? '?'}` }
    }
    let i = start + 1
    const sel: Sel[] = []

    /* Inline a named fragment's fields into `target` (cycle-guarded). */
    const inlineNamed = (target: Sel[], fragName: string): void => {
      if (seen.has(fragName)) return
      seen.add(fragName)
      const fragSel = fragments[fragName]
      if (!fragSel) return
      for (const f of fragSel) target.push(fragmentCopy(f))
    }

    /* Deep copy of a parsed field node — spreads were inlined at parse time. */
    const fragmentCopy = (f: Sel): Sel => ({
      name: f.name,
      alias: f.alias,
      args: { ...f.args },
      sub: f.sub ? f.sub.map(fragmentCopy) : null,
      fragmentNames: [],
      inlineFragments: [],
    })

    while (i < tokens.length) {
      const t = tk(tokens, i)
      if (t.type === 'punct' && t.value === '}') return { sel, next: i + 1, error: undefined }
      if (t.type === 'punct' && (t.value === '{' || t.value === ')')) {
        return { sel, next: i, error: `Unexpected '${t.value}' at line ${t.line}` }
      }
      if (t.type === 'spread') {
        i++
        const next = tk(tokens, i)
        if (next?.type === 'name' && next.value === 'on') {
          i++
          const typeName = tk(tokens, i)?.value ?? ''
          if (typeName) i++
          const sub = parseSelectionSet(i, new Set(seen))
          if (sub.error) return { sel: [], next: sub.next, error: sub.error }
          sel.push(...sub.sel)
          i = sub.next
          continue
        }
        const fragName = next?.value ?? ''
        if (fragName) i++
        inlineNamed(sel, fragName)
        continue
      }
      if (t.type === 'punct' && t.value === '@') {
        // Skip directives (@skip/@include/@deprecated) entirely.
        i++
        if (tk(tokens, i)?.type === 'name') {
          i++
          if (tk(tokens, i)?.type === 'punct' && tk(tokens, i).value === '(') {
            let depth = 1
            i++
            while (i < tokens.length && depth > 0) {
              if (tk(tokens, i).type === 'punct') {
                if (tk(tokens, i).value === '(') depth++
                else if (tk(tokens, i).value === ')') depth--
              }
              i++
            }
          }
        }
        continue
      }
      // Field: [alias ':'] name [args] [sub]
      let name = t.value
      let alias: string | undefined
      i++
      if (tk(tokens, i)?.type === 'punct' && tk(tokens, i).value === ':') {
        alias = name
        i++
        name = tk(tokens, i)?.value ?? ''
        i++
      }
      const args: Record<string, ArgValue> = {}
      if (tk(tokens, i)?.type === 'punct' && tk(tokens, i).value === '(') {
        let j = i + 1
        while (j < tokens.length && !(tk(tokens, j).type === 'punct' && tk(tokens, j).value === ')')) {
          if (tk(tokens, j).type === 'punct' && tk(tokens, j).value === ',') {
            j++
            continue
          }
          const keyTok = tk(tokens, j)
          if (keyTok?.type !== 'name' || tk(tokens, j + 1)?.type !== 'punct' || tk(tokens, j + 1)?.value !== ':') {
            return { sel: [], next: j, error: `Bad argument at line ${keyTok?.line ?? '?'}` }
          }
          const r = readValue(j + 2)
          if (r.error) return { sel: [], next: j, error: r.error }
          args[keyTok.value] = r.value
          j = r.next
        }
        i = j >= tokens.length ? j : j + 1
      }
      const entry: Sel = { name, alias, args, sub: null, fragmentNames: [], inlineFragments: [] }
      if (tk(tokens, i)?.type === 'punct' && tk(tokens, i).value === '{') {
        const r = parseSelectionSet(i, new Set(seen))
        if (r.error) return { sel: [], next: r.next, error: r.error }
        entry.sub = r.sel
        i = r.next
      }
      sel.push(entry)
    }
    return { sel, next: i, error: "Unclosed selection set (missing '}')" }
  }

  // Pass 1 — collect `fragment X on Type { … }` blocks wherever they appear.
  {
    let idx = 0
    while (idx < tokens.length) {
      if (tk(tokens, idx).type === 'name' && tk(tokens, idx).value === 'fragment') {
        const fragName = tk(tokens, idx + 1)?.value ?? ''
        let open = -1
        let brace = 0
        let paren = 0
        for (let k = idx + 2; k < tokens.length; k++) {
          if (tk(tokens, k).type !== 'punct') continue
          if (tk(tokens, k).value === '(') paren++
          else if (tk(tokens, k).value === ')') paren = Math.max(0, paren - 1)
          else if (tk(tokens, k).value === '{') {
            if (brace === 0 && paren === 0) {
              open = k
              break
            }
            brace++
          } else if (tk(tokens, k).value === '}') brace = Math.max(0, brace - 1)
        }
        if (open >= 0) {
          const sub = parseSelectionSet(open)
          if (!sub.error && fragName) fragments[fragName] = sub.sel
          idx = sub.next
          continue
        }
      }
      idx++
    }
  }

  // Pass 2 — locate the operation's selection set (brace at paren depth 0).
  let brace = 0
  let paren = 0
  let selIdx = -1
  for (let k = 0; k < tokens.length; k++) {
    const t = tk(tokens, k)
    if (!t || t.type !== 'punct') continue
    if (t.value === '(') paren++
    else if (t.value === ')') paren = Math.max(0, paren - 1)
    else if (t.value === '{') {
      if (brace === 0 && paren === 0) {
        selIdx = k
        break
      }
      brace++
    } else if (t.value === '}') brace = Math.max(0, brace - 1)
  }
  if (selIdx < 0) return { selection: [], fragments, error: 'No selection set found' }

  const result = parseSelectionSet(selIdx)
  if (result.error) return { selection: [], fragments, error: result.error }

  return { selection: result.sel, fragments, error: undefined }
}

/* -------------------------------- execution ------------------------------- */

function typeNameOf(obj: unknown): string {
  if (obj === null || obj === undefined) return ''
  if (Array.isArray(obj)) return 'list'
  return typeof obj
}

const ROOT_RESOLVER: Record<string, (args: Record<string, ArgValue>) => unknown> = {
  me: () => USERS[0]!,
  users: () => USERS,
  user: ({ id }) => (id ? USERS.find((u) => u.id === id) : null),
  orders: () => ORDERS,
  order: ({ id }) => (id ? ORDERS.find((o) => o.id === id) : null),
  payments: () => PAYMENTS,
  payment: ({ id }) => (id ? PAYMENTS.find((p) => p.id === id) : null),
  health: () => ({ ok: true, service: 'graphql-gateway', version: '1.0.0' }),
}

const FIELD_RESOLVERS: Record<string, Record<string, (parent: unknown, args: Record<string, unknown>) => unknown>> = {
  User: {
    id: (u) => (u as DemoUser).id,
    name: (u) => (u as DemoUser).name,
    email: (u) => (u as DemoUser).email,
    status: (u) => (u as DemoUser).status,
    orders: () => ORDERS,
  },
  Order: {
    id: (o) => (o as DemoOrder).id,
    status: (o) => (o as DemoOrder).status,
    total: (o) => (o as DemoOrder).total,
    currency: (o) => (o as DemoOrder).currency,
    placedAt: (o) => (o as DemoOrder).placedAt,
    items: (o) => (o as DemoOrder).items,
  },
  OrderItem: {
    sku: (i) => (i as DemoOrderItem).sku,
    quantity: (i) => (i as DemoOrderItem).quantity,
    product: (i) => (i as DemoOrderItem).product,
  },
  Product: {
    id: (p) => (p as { id: string }).id,
    name: (p) => (p as { name: string }).name,
    price: (p) => (p as { price: number }).price,
  },
  Payment: {
    id: (p) => (p as DemoPayment).id,
    status: (p) => (p as DemoPayment).status,
    amount: (p) => (p as DemoPayment).amount,
    method: (p) => (p as DemoPayment).method,
    orderId: (p) => (p as DemoPayment).orderId,
  },
  Health: {
    ok: (h) => (h as { ok: boolean }).ok,
    service: (h) => (h as { service: string }).service,
    version: (h) => (h as { version: string }).version,
  },
}

function resolveSelection(
  parentValue: unknown,
  typeName: string,
  selection: Sel[],
  errors: GraphQLError[],
  path: string[]
): unknown {
  if (selection.length === 0) return parentValue
  if (parentValue === null || parentValue === undefined) return parentValue
  if (Array.isArray(parentValue)) {
    return parentValue.map((item, idx) => resolveSelection(item, typeName, selection, errors, [...path, String(idx)]))
  }

  const result: Record<string, unknown> = {}
  for (const sel of selection) {
    const key = sel.alias ?? sel.name
    const fn = FIELD_RESOLVERS[typeName]?.[sel.name]
    const value = fn ? fn(parentValue, sel.args as Record<string, unknown>) : undefined

    if (value === undefined) {
      errors.push({ message: `Cannot query field "${sel.name}" on type "${typeName}".`, path: [...path, key] })
      if (sel.sub) result[key] = resolveSelection({}, typeName, sel.sub, errors, [...path, key])
      continue
    }

    if (sel.sub && value !== null) {
      if (Array.isArray(value)) {
        result[key] = value.map((item, idx) =>
          resolveSelection(item, childTypeOf(typeName, sel.name), sel.sub!, errors, [...path, key, String(idx)])
        )
      } else {
        result[key] = resolveSelection(value, childTypeOf(typeName, sel.name), sel.sub, errors, [...path, key])
      }
    } else {
      result[key] = value
    }
  }
  return result
}

/** Infer the runtime object type of a field's children from the schema model. */
function childTypeOf(parentTypeName: string, fieldName: string): string {
  const parent = DEMO_SCHEMA.types.find((t) => t.kind === 'object' && t.name === parentTypeName) as
    | GraphQLObjectType
    | undefined
  return parent?.fields.find((f) => f.name === fieldName)?.type.replace(/[[\]!]/g, '') ?? 'String'
}

/* ------------------------------ public API -------------------------------- */

export interface GraphQLExecuteInput {
  query: string
  variables?: Record<string, string | number | boolean>
  endpoint?: string
}

/**
 * Execute a small demo GraphQL document against the Acme datasource. Returns a
 * mocked, fully-shaped response tree — the same shape a real server would
 * return — plus any GraphQL-style errors collected during parsing/resolution.
 */
export function executeGraphQL(input: GraphQLExecuteInput): GraphQLExecutionResult {
  const { query, variables = {}, endpoint = 'https://api.acme.dev/graphql' } = input
  const substituted = query.replace(/\$[A-Za-z_][A-Za-z0-9_]*/g, (ref) => {
    const name = ref.slice(1)
    return name in variables ? JSON.stringify(variables[name]) : ref
  })
  const { tokens, error: lexError } = tokenize(substituted)
  if (lexError) return { handledByMock: true, endpoint, errors: [{ message: lexError }] }

  const parsed = parseDocument(tokens)
  if (parsed.error) return { handledByMock: true, endpoint, errors: [{ message: parsed.error }] }
  if (parsed.selection.length === 0) {
    return { handledByMock: true, endpoint, errors: [{ message: 'Selection set was empty.' }] }
  }

  const errors: GraphQLError[] = []
  const operation = parseOperation(tokens).operation
  const isMutation = operation.startsWith('mutation')
  const selection = parsed.selection

  const data: Record<string, unknown> = {}

  for (const sel of selection) {
    const resolver = ROOT_RESOLVER[sel.name]
    if (!isMutation && !resolver) {
      errors.push({ message: `Cannot query field "${sel.name}" on type "Query".`, path: [sel.name] })
      continue
    }
    const args = sel.args
    let value: unknown
    if (isMutation) {
      value = resolveMutation(sel.name, args)
    } else {
      value = resolver ? resolver(args) : undefined
    }
    if (value === undefined) {
      errors.push({ message: `Cannot resolve field "${sel.name}".`, path: [sel.name] })
      continue
    }
    const typeName = isMutation ? childTypeOf('Mutation', sel.name) : childTypeOf('Query', sel.name)
    data[sel.alias ?? sel.name] = sel.sub ? resolveSelection(value, typeName, sel.sub, errors, [sel.name]) : value
  }

  if (errors.length > 0 && Object.keys(data).length === 0) {
    return { handledByMock: true, endpoint, errors }
  }
  return { handledByMock: true, endpoint, data, errors: errors.length ? errors : undefined }
}

function resolveMutation(
  name: string,
  args: Record<string, unknown>
): unknown {
  switch (name) {
    case 'createUser': {
      return { id: `usr_${generateId('x').split('_')[1]}`, name: args['name'] ?? 'Unknown', email: args['email'] ?? '', status: 'active' }
    }
    case 'createOrder': {
      const items = Array.isArray(args['items'])
        ? (args['items'] as { sku?: string; quantity?: number }[]).map((it) => ({
            sku: it.sku ?? 'acme-1',
            quantity: it.quantity ?? 1,
            product: PRODUCTS.find((p) => p.id === it.sku) ?? PRODUCTS[0]!,
          }))
        : [{ sku: 'acme-1', quantity: 1, product: PRODUCTS[0]! }]
      return {
        id: `ord_${generateId('x').split('_')[1]}`,
        status: 'PROCESSING',
        total: items.reduce((acc, it) => acc + it.product.price * it.quantity, 0),
        currency: 'USD',
        placedAt: new Date().toISOString(),
        items,
      }
    }
    case 'createPayment': {
      return { id: `pay_${generateId('x').split('_')[1]}`, status: 'succeeded', amount: args['amount'] ?? 0, method: 'visa', orderId: args['orderId'] ?? '' }
    }
    default:
      return undefined
  }
}

/* --------------------------- pretty-printing ------------------------------ */

/** Read a balanced parenthesized block back into an inline token string. */
function readParenGroup(tokens: Token[], start: number): { text: string; next: number } {
  const parts: string[] = []
  let i = start
  let depth = 0
  while (i < tokens.length) {
    const t = tk(tokens, i)
    if (t.type === 'punct') {
      if (t.value === '(') { depth++; i++; continue }
      if (t.value === ')') {
        depth--
        if (depth === 0) return { text: parts.join('').trimEnd(), next: i + 1 }
        i++
        continue
      }
      if (t.value === ':' || t.value === ',') {
        if (parts.length > 0) parts[parts.length - 1] = parts[parts.length - 1]!.trimEnd()
        parts.push(`${t.value} `)
        i++
        continue
      }
      parts.push(`${t.value} `)
      i++
      continue
    }
    parts.push((t.type === 'string' ? JSON.stringify(t.value) : t.value) + ' ')
    i++
  }
  return { text: parts.join('').trimEnd(), next: i }
}

/**
 * A brace-balanced GraphQL pretty-printer. One linear pass over tokens:
 * blocks indent under braces, arguments/paren groups stay inline, and
 * fragment definitions are preserved at the top.
 */
export function formatGraphQL(source: string): string {
  const { tokens, error } = tokenize(source)
  if (error || tokens.length === 0) return source.trim()

  const lines: string[] = []
  const fragments: string[] = []
  let current = ''
  let indent = 0
  let i = 0

  const flush = () => {
    if (current.trim() !== '') {
      lines.push('  '.repeat(Math.max(0, indent)) + current.trim())
      current = ''
    }
  }

  while (i < tokens.length) {
    const t = tk(tokens, i)
    if (!t) break
    if (t.type === 'name' && t.value === 'fragment') {
      // Copy the whole fragment block verbatim into `fragments`.
      const frag: string[] = []
      let depth = 0
      let j = i
      while (j < tokens.length) {
        const fj = tk(tokens, j)
        if (!fj) break
        frag.push(fj.type === 'string' ? JSON.stringify(fj.value) : fj.value)
        if (fj.type === 'punct') {
          if (fj.value === '{') depth++
          else if (fj.value === '}') depth--
        }
        j++
        if (depth === 0 && j > i) break
      }
      fragments.push(frag.join(' '))
      flush()
      i = j
      continue
    }

    if (t.type === 'punct') {
      if (t.value === '{') {
        flush()
        lines.push('  '.repeat(Math.max(0, indent)) + '{')
        indent++
      } else if (t.value === '}') {
        flush()
        indent = Math.max(0, indent - 1)
        lines.push('  '.repeat(indent) + '}')
      } else if (t.value === '(') {
        // Argument/variable group — inline when a field/op name precedes it,
        // otherwise its own line (e.g. a fresh `(…)` after `{`).
        const group = readParenGroup(tokens, i)
        if (current.trim() !== '') {
          current = current.trimEnd() + `(${group.text})`
        } else {
          lines.push('  '.repeat(Math.max(0, indent)) + `(${group.text})`)
        }
        i = group.next - 1
      } else if (t.value === ':') {
        current += ': '
      } else {
        current += t.value + ' '
      }
    } else if (t.type === 'name') {
      // One field per line inside selection blocks; operation names stay
      // glued at the top level (e.g. `query GetUser`).
      if (indent > 0 && current.trim() !== '') flush()
      current += t.value + ' '
    } else {
      current += (t.type === 'string' ? JSON.stringify(t.value) : t.value) + ' '
    }
    i++
  }
  flush()

  const head = fragments.length > 0 ? fragments.join('\n\n') + '\n\n' : ''
  return (head + lines.join('\n')).replace(/\s+$/, '') + '\n'
}

export function typeNameForDisplay(actual: unknown, requested: string): string {
  if (actual === null) return 'null'
  if (Array.isArray(actual)) return `array[${requested}]`
  return typeNameOf(actual)
}