import Ajv from 'ajv'
import type { ValidateFunction } from 'ajv'
import type { Assertion } from '../types/request'
import type { ResponseModel } from '../types/response'

const ajv = new Ajv({ allErrors: true })
/** Compiled-validator cache, keyed by the raw schema text — assertions run
 * repeatedly (every Collection Runner iteration) and compiling is not free. */
const compiledSchemaCache = new Map<string, ValidateFunction | Error>()

function compileSchema(schemaText: string): ValidateFunction | Error {
  const cached = compiledSchemaCache.get(schemaText)
  if (cached) return cached
  let result: ValidateFunction | Error
  try {
    const schema = JSON.parse(schemaText)
    result = ajv.compile(schema)
  } catch (err) {
    result = err instanceof Error ? err : new Error(String(err))
  }
  compiledSchemaCache.set(schemaText, result)
  return result
}

export interface AssertionResult {
  assertion: Assertion
  passed: boolean
  message: string
}

/**
 * Resolves a dot/bracket path like `$.data.users[0].id` against a value.
 * Shared by assertion evaluation (`jsonPathExists`/`jsonPathEquals`) and the
 * Collection Runner's chain-extraction rules — same lightweight path syntax
 * both places, one implementation.
 */
export function resolvePath(value: unknown, path: string): unknown {
  const tokens = path
    .replace(/^\$\.?/, '')
    .split(/[.[\]]/)
    .filter(Boolean)
  let current: unknown = value
  for (const token of tokens) {
    if (current === null || current === undefined) return undefined
    current = (current as Record<string, unknown>)[token]
  }
  return current
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase())
  return key ? headers[key] : undefined
}

/** Evaluates one assertion against a response. Pure, synchronous, no I/O. */
export function evaluateAssertion(assertion: Assertion, response: ResponseModel): AssertionResult {
  switch (assertion.type) {
    case 'statusCodeEquals': {
      const expected = Number(assertion.expected)
      const passed = response.status === expected
      return {
        assertion,
        passed,
        message: passed ? `Status is ${response.status}` : `Expected status ${expected}, got ${response.status}`,
      }
    }
    case 'responseTimeLessThan': {
      const expected = Number(assertion.expected)
      const passed = response.timeMs < expected
      return {
        assertion,
        passed,
        message: passed
          ? `${response.timeMs}ms < ${expected}ms`
          : `${response.timeMs}ms is not less than ${expected}ms`,
      }
    }
    case 'jsonPathExists': {
      const value = resolvePath(response.body, assertion.target)
      const passed = value !== undefined
      return { assertion, passed, message: passed ? `${assertion.target} exists` : `${assertion.target} is missing` }
    }
    case 'jsonPathEquals': {
      const value = resolvePath(response.body, assertion.target)
      const actual = value === undefined ? '' : String(value)
      const passed = actual === assertion.expected
      return {
        assertion,
        passed,
        message: passed
          ? `${assertion.target} equals ${assertion.expected}`
          : `${assertion.target} was "${actual}", expected "${assertion.expected}"`,
      }
    }
    case 'headerExists': {
      const value = headerValue(response.headers, assertion.target)
      const passed = value !== undefined
      return {
        assertion,
        passed,
        message: passed ? `Header "${assertion.target}" is present` : `Header "${assertion.target}" is missing`,
      }
    }
    case 'schemaMatches': {
      // Convention (set by TestsPanel's UI): `expected` holds the JSON Schema
      // text itself; `target` is just a display label, not a lookup key.
      const compiled = compileSchema(assertion.expected)
      if (compiled instanceof Error) {
        return { assertion, passed: false, message: `Invalid JSON schema: ${compiled.message}` }
      }
      const passed = Boolean(compiled(response.body))
      if (passed) return { assertion, passed, message: 'Response body matches the schema' }
      const errors = (compiled.errors ?? [])
        .slice(0, 3)
        .map((e) => `${e.dataPath || '(root)'} ${e.message ?? ''}`.trim())
        .join('; ')
      return { assertion, passed, message: errors || 'Response body does not match the schema' }
    }
  }
}

export function evaluateAssertions(assertions: Assertion[], response: ResponseModel): AssertionResult[] {
  return assertions.filter((a) => a.enabled).map((a) => evaluateAssertion(a, response))
}
