export interface TimingBreakdown {
  dns: number
  connect: number
  tls: number
  /** Time to first byte. */
  wait: number
  download: number
  total: number
}

export interface ResponseCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: string
  httpOnly?: boolean
  secure?: boolean
}

export interface RedirectEntry {
  url: string
  status: number
}

export interface ClientError {
  code: string
  message: string
  cause?: string
}

export interface ResponseModel {
  requestId?: string
  status: number
  statusText: string
  headers: Record<string, string>
  /** Parsed body when the content type is JSON. */
  body?: unknown
  /** Raw body text. */
  bodyText: string
  size: number
  timeMs: number
  timing: TimingBreakdown
  cookies: ResponseCookie[]
  redirects: RedirectEntry[]
  error?: ClientError
  handledByMock?: boolean
}