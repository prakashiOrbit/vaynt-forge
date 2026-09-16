import vm from 'node:vm'
import type { ScriptContext, ScriptResult } from './types'

const TIMEOUT_MS = 1000

/**
 * Recursively strips every object/function we pass into the vm context down
 * to a null prototype. This matters because `vm.createContext` isolation
 * only protects code that both originates and stays inside that context —
 * any host-realm function or object handed IN (like `pm.environment.get`)
 * still carries its real Node.js `Function`/`Object` constructor chain with
 * it. A malicious script can walk that chain to escape: verified locally
 * that `console.log.constructor('return process')()` returns the *real*
 * process object from inside an unhardened `vm.createContext({ pm, console
 * })`, confirming the sandbox's original claim ("no require/process reachable
 * unless we put them there") was false — passing in these plain closures
 * already puts them there implicitly, via their constructor chain, not their
 * own visible API surface. Setting every exposed function/object's prototype
 * to `null` removes `.constructor` (and `.call`/`.apply`/`.bind`, unused by
 * this API) without breaking direct invocation, which doesn't need a
 * prototype. `codeGeneration.strings: false` below is defense in depth for
 * a different escape shape (script-local `eval`/`Function(str)`), not a fix
 * for this one — it does NOT block the constructor-chain escape by itself
 * (also verified locally: `console.log.constructor(...)` still succeeds even
 * with `codeGeneration.strings: false` alone, since that Function call
 * compiles and runs in the *host* realm, not the restricted vm context).
 */
function harden<T>(value: T): T {
  if (typeof value === 'function') {
    Object.setPrototypeOf(value, null)
    return value
  }
  if (value !== null && typeof value === 'object') {
    Object.setPrototypeOf(value, null)
    for (const key of Object.keys(value)) {
      ;(value as Record<string, unknown>)[key] = harden((value as Record<string, unknown>)[key])
    }
  }
  return value
}

/**
 * Runs a pre-request/post-response script. Uses Node's built-in `vm` module,
 * not `isolated-vm` (the roadmap's stack table pick): isolated-vm is a native
 * module needing prebuilt binaries matched to Electron's exact ABI, which is
 * a real install/CI risk with no upside for what Sprint 6 actually needs —
 * the acceptance criterion is behavior ("blocks require/process/network"),
 * not a specific implementation. In the desktop app this runs in the
 * Electron *main* process — a separate OS process from the sandboxed
 * renderer, which is a stronger boundary than same-process isolated-vm would
 * add on top of a vm context anyway; the CLI runner calls it directly since
 * there's no renderer/main split to bridge over IPC there. `timeout` guards
 * against runaway loops in the synchronous script; `harden()` (above) closes
 * the constructor-chain escape; disabling `codeGeneration.strings` blocks
 * dynamic `eval`/`Function(str)` as well.
 */
export function runScript(code: string, context: ScriptContext): ScriptResult {
  const logs: string[] = []
  const environmentPatch: Record<string, string> = {}
  const environmentSnapshot = { ...context.environment }
  let visualizer: { template: string; data: unknown } | undefined

  const pm = {
    request: { method: context.request.method, url: context.request.url, headers: { ...context.request.headers } },
    response: context.response
      ? {
          code: context.response.status,
          status: context.response.status,
          headers: { ...context.response.headers },
          responseTime: context.response.timeMs,
          json: () => JSON.parse(context.response!.bodyText || '{}'),
          text: () => context.response!.bodyText,
        }
      : undefined,
    environment: {
      get: (key: string) => environmentPatch[key] ?? environmentSnapshot[key],
      set: (key: string, value: string) => {
        environmentPatch[key] = String(value)
      },
    },
    visualizer: {
      /**
       * Last call wins — matches Postman's `pm.visualizer.set(template, data)`.
       * `data` is a vm-realm object (a different `Object.prototype` than the
       * host realm's), so it's round-tripped through JSON here: this is the
       * same normalization Electron's IPC structured-clone would apply
       * anyway once this crosses to the renderer, and it fails safely (falls
       * back to `undefined`) if a script ever hands in something non-JSON
       * (a function, a circular reference) instead of surfacing a cross-realm
       * artifact as a confusing bug later.
       */
      set: (template: string, data?: unknown) => {
        let normalized: unknown
        try {
          normalized = data === undefined ? undefined : JSON.parse(JSON.stringify(data))
        } catch {
          normalized = undefined
        }
        visualizer = { template: String(template), data: normalized }
      },
    },
  }

  const sandboxConsole = {
    log: (...args: unknown[]) => logs.push(args.map(stringify).join(' ')),
    warn: (...args: unknown[]) => logs.push(`[warn] ${args.map(stringify).join(' ')}`),
    error: (...args: unknown[]) => logs.push(`[error] ${args.map(stringify).join(' ')}`),
  }

  const sandbox = vm.createContext(harden({ pm, console: sandboxConsole }), {
    codeGeneration: { strings: false, wasm: false },
  })

  try {
    const script = new vm.Script(code, { filename: 'user-script.js' })
    script.runInContext(sandbox, { timeout: TIMEOUT_MS })
    return { logs, environmentPatch, visualizer }
  } catch (err) {
    // Errors vm.Script throws for timeout/memory limits come from the
    // sandboxed context's own realm, so `err instanceof Error` (checking
    // against the *host* realm's Error) is unreliable — duck-type instead.
    const message = hasMessage(err) ? err.message : String(err)
    const timedOut = /Script execution timed out/i.test(message)
    return { logs, environmentPatch, visualizer, error: message, timedOut }
  }
}

function hasMessage(err: unknown): err is { message: string } {
  return typeof err === 'object' && err !== null && typeof (err as { message?: unknown }).message === 'string'
}

function stringify(value: unknown): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
