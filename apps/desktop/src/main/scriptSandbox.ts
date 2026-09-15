import vm from 'node:vm'
import type { ScriptContext, ScriptResult } from '@vayntforge/engine'

const TIMEOUT_MS = 1000

/**
 * Runs a pre-request/post-response script. Uses Node's built-in `vm` module,
 * not `isolated-vm` (the roadmap's stack table pick): isolated-vm is a native
 * module needing prebuilt binaries matched to Electron's exact ABI, which is
 * a real install/CI risk with no upside for what Sprint 6 actually needs —
 * the acceptance criterion is behavior ("blocks require/process/network"),
 * not a specific implementation. `vm.createContext` starts genuinely empty
 * (no `require`, `process`, or fetch/XHR exist unless we put them there, and
 * we don't), and this already runs in the Electron *main* process — a
 * separate OS process from the sandboxed renderer, which is a stronger
 * boundary than same-process isolated-vm would add on top of a vm context
 * anyway. `timeout` guards against runaway loops in the synchronous script.
 */
export function runScript(code: string, context: ScriptContext): ScriptResult {
  const logs: string[] = []
  const environmentPatch: Record<string, string> = {}
  const environmentSnapshot = { ...context.environment }

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
  }

  const sandboxConsole = {
    log: (...args: unknown[]) => logs.push(args.map(stringify).join(' ')),
    warn: (...args: unknown[]) => logs.push(`[warn] ${args.map(stringify).join(' ')}`),
    error: (...args: unknown[]) => logs.push(`[error] ${args.map(stringify).join(' ')}`),
  }

  const sandbox = vm.createContext({ pm, console: sandboxConsole })

  try {
    const script = new vm.Script(code, { filename: 'user-script.js' })
    script.runInContext(sandbox, { timeout: TIMEOUT_MS })
    return { logs, environmentPatch }
  } catch (err) {
    // Errors vm.Script throws for timeout/memory limits come from the
    // sandboxed context's own realm, so `err instanceof Error` (checking
    // against the *host* realm's Error) is unreliable — duck-type instead.
    const message = hasMessage(err) ? err.message : String(err)
    const timedOut = /Script execution timed out/i.test(message)
    return { logs, environmentPatch, error: message, timedOut }
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
