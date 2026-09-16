/**
 * Types only, kept separate from `./sandbox` so anything importing these
 * shapes (e.g. renderer-side code building a `ScriptContext`) doesn't pull
 * in `node:vm`. The actual sandboxed execution (`./sandbox`, Node-only, same
 * pattern as `../networking/http-client`) needs Node's `vm` module, so the
 * browser-only renderer reaches it over IPC (`window.vayntforge.scripts.run`
 * → `apps/desktop/src/main/ipc.ts` → this package's `scripting/sandbox`)
 * instead of importing it directly; the CLI runner calls it directly since
 * there's no renderer/main split to bridge there.
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
  /** Set by `pm.visualizer.set(template, data)` — last call wins; rendered by the Response panel's Visualize tab. */
  visualizer?: { template: string; data: unknown }
  error?: string
  timedOut?: boolean
}
