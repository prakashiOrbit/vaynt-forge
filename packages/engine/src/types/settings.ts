export type ThemePreference = 'system' | 'dark' | 'light'

export interface ProxyConfig {
  enabled: boolean
  host: string
  port: number
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
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'system',
  autoSave: true,
  confirmDeletes: true,
  requestTimeoutMs: 30000,
  followRedirects: true,
  sslVerify: true,
  proxy: { enabled: false, host: '', port: 8080 },
}