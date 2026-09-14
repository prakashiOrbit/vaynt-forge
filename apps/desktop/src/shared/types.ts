export interface ApiForgeApi {
  app: {
    /** Proves the renderer ↔ main IPC round-trip works (Sprint 0). */
    ping(): Promise<string>
    version: string
  }
}