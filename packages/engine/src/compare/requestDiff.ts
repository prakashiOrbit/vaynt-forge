import type { RequestModel } from '../types/request.js'
import type { ResponseModel } from '../types/response.js'
import { diffLines, linesAreIdentical, type DiffLine } from './diff.js'

export interface FieldDiff {
  label: string
  identical: boolean
  lines: DiffLine[]
}

export interface RequestComparison {
  url: FieldDiff
  method: FieldDiff
  headers: FieldDiff
  params: FieldDiff
  body: FieldDiff
}

function pairsToText(pairs: { key: string; value: string; enabled: boolean }[]): string {
  return pairs
    .filter((p) => p.enabled && p.key)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((p) => `${p.key}: ${p.value}`)
    .join('\n')
}

function bodyToText(request: RequestModel): string {
  const body = request.body
  if (body.type === 'none') return ''
  if (body.type === 'raw') return body.content
  if (body.type === 'graphql') return `${body.query}\n\n${body.variables}`
  if (body.type === 'binary') return `<binary: ${body.source}>`
  return pairsToText(body.pairs)
}

function field(label: string, a: string, b: string): FieldDiff {
  const lines = diffLines(a, b)
  return { label, identical: linesAreIdentical(lines), lines }
}

/** Structured diff of two requests — URL, method, headers, params, body. */
export function compareRequests(a: RequestModel, b: RequestModel): RequestComparison {
  return {
    url: field('URL', a.url, b.url),
    method: field('Method', a.method, b.method),
    headers: field('Headers', pairsToText(a.headers), pairsToText(b.headers)),
    params: field('Params', pairsToText(a.params), pairsToText(b.params)),
    body: field('Body', bodyToText(a), bodyToText(b)),
  }
}

/** Structured diff of two responses — status, headers, body. */
export function compareResponses(a: ResponseModel, b: ResponseModel): FieldDiff {
  const textA = `${a.status} ${a.statusText}\n\n${Object.entries(a.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .sort()
    .join('\n')}\n\n${a.bodyText}`
  const textB = `${b.status} ${b.statusText}\n\n${Object.entries(b.headers)
    .map(([k, v]) => `${k}: ${v}`)
    .sort()
    .join('\n')}\n\n${b.bodyText}`
  return field('Response', textA, textB)
}
