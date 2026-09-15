/**
 * Sprint 12 — HAR (HTTP Archive) importer. Produces plain history-entry
 * drafts; the caller (renderer) attaches `workspaceId` and calls `addHistory`
 * per entry — same as any other executed request being logged.
 */
export interface HarHistoryDraft {
  method: string
  url: string
  status: number
  statusText: string
  durationMs: number
  size?: number
  timestamp: number
}

interface HarEntry {
  startedDateTime?: string
  time?: number
  request?: { method?: string; url?: string }
  response?: { status?: number; statusText?: string; content?: { size?: number } }
}

interface HarDoc {
  log?: { entries?: HarEntry[] }
}

/** Parses a HAR file's entries into history drafts, skipping malformed rows
 * rather than failing the whole import over one bad entry. */
export function parseHar(raw: unknown): HarHistoryDraft[] {
  const doc = raw as HarDoc
  const entries = doc?.log?.entries
  if (!Array.isArray(entries)) {
    throw new Error('Not a valid HAR file (expected a "log.entries" array)')
  }
  const drafts: HarHistoryDraft[] = []
  for (const entry of entries) {
    const method = entry.request?.method
    const url = entry.request?.url
    const status = entry.response?.status
    if (!method || !url || typeof status !== 'number') continue
    const timestamp = entry.startedDateTime ? Date.parse(entry.startedDateTime) : NaN
    drafts.push({
      method: method.toUpperCase(),
      url,
      status,
      statusText: entry.response?.statusText ?? '',
      durationMs: Math.max(0, Math.round(entry.time ?? 0)),
      size: entry.response?.content?.size,
      timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
    })
  }
  return drafts
}
