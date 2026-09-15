export type ThemePreference = 'system' | 'dark' | 'light'

export interface ProxyConfig {
  enabled: boolean
  host: string
  port: number
}

/** CodeMirror-backed editors — no minimap equivalent exists in CodeMirror
 * (unlike Monaco), so that roadmap item is intentionally not represented
 * here rather than faked with a no-op toggle. */
export interface EditorSettings {
  fontSize: number
  tabSize: number
  wordWrap: boolean
  autocomplete: boolean
}

export interface CertificateEntry {
  id: string
  name: string
  /** PEM-encoded CA certificate content. */
  pem: string
  addedAt: number
}

/** Per-workspace application settings, persisted as the `settings` row. */
export interface AppSettings {
  theme: ThemePreference
  autoSave: boolean
  confirmDeletes: boolean
  requestTimeoutMs: number
  followRedirects: boolean
  sslVerify: boolean
  proxy: ProxyConfig
  editor: EditorSettings
  certificates: CertificateEntry[]
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 2,
  wordWrap: true,
  autocomplete: true,
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  autoSave: true,
  confirmDeletes: true,
  requestTimeoutMs: 30000,
  followRedirects: true,
  sslVerify: true,
  proxy: { enabled: false, host: '', port: 8080 },
  editor: DEFAULT_EDITOR_SETTINGS,
  certificates: [],
}