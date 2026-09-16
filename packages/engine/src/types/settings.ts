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

/**
 * A client (mTLS) certificate — presented BY this app TO a server that
 * requires one, unlike {@link CertificateEntry} (a CA this app trusts).
 * Matched to a request by exact hostname (and port, when set) before
 * sending, same as Postman's client-certificate manager. Either
 * `certPath`+`keyPath` (PEM) or `pfxPath` (PKCS#12) is set, never both —
 * paths are stored (not file content) and read fresh at send time, the same
 * pattern binary request bodies already use.
 */
export interface ClientCertificateEntry {
  id: string
  host: string
  /** When set, must also match the request's resolved port; omitted matches any port on `host`. */
  port?: number
  /** Absolute path to a PEM-encoded client certificate file. */
  certPath?: string
  /** Absolute path to a PEM-encoded private key file (paired with `certPath`). */
  keyPath?: string
  /** Absolute path to a PFX/PKCS#12 bundle file (mutually exclusive with `certPath`/`keyPath`). */
  pfxPath?: string
  /** Passphrase for an encrypted private key or PFX bundle. */
  passphrase?: string
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
  clientCertificates: ClientCertificateEntry[]
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
  clientCertificates: [],
}