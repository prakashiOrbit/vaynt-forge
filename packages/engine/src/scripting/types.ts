/**
 * Types only — the actual sandboxed execution needs Node's `vm` module and a
 * real process boundary, neither available in the (browser-only) renderer or
 * in this Electron-free package. The runtime lives in
 * `apps/desktop/src/main/scriptSandbox.ts` and is reached over IPC
 * (`window.vayntforge.scripts.run`), the same split `packages/sqlite` uses
 * for Node-only storage code.
 */
export interface ScriptContext {
  request: {
    method: string
    url: string
    headers: Record<string, string>
  }
  response?: {
    status: number
    headers: Record<string, string>
    body: unknown
    bodyText: string
    timeMs: number
  }
  /** Snapshot of resolved global+environment variables, key → value. */
  environment: Record<string, string>
}

export interface ScriptResult {
  logs: string[]
  /** `pm.environment.set(key, value)` calls — applied by the caller, not persisted here. */
  environmentPatch: Record<string, string>
  error?: string
  timedOut?: boolean
}
