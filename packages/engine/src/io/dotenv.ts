export interface DotEnvEntry {
  key: string
  value: string
}

/**
 * Parses `.env`-format text (`KEY=VALUE`, one per line) into key/value pairs.
 * Supports `#` comments, blank lines, an optional leading `export `, and
 * single/double-quoted values (with `\n` un-escaped inside double quotes,
 * matching common `.env` tooling). Unquoted values are trimmed as-is.
 */
export function parseDotEnv(content: string): DotEnvEntry[] {
  const entries: DotEnvEntry[] = []
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const withoutExport = line.startsWith('export ') ? line.slice('export '.length) : line
    const eq = withoutExport.indexOf('=')
    if (eq === -1) continue
    const key = withoutExport.slice(0, eq).trim()
    if (!key) continue
    let value = withoutExport.slice(eq + 1).trim()
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1).replace(/\\n/g, '\n')
    } else if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1)
    }
    entries.push({ key, value })
  }
  return entries
}

/** Inverse of {@link parseDotEnv} — Sprint 12's Environment export. Quotes
 * any value containing whitespace, `#`, or `=` so it round-trips through
 * `parseDotEnv` unchanged. */
export function stringifyDotEnv(entries: DotEnvEntry[]): string {
  return entries
    .map(({ key, value }) => {
      const needsQuotes = /[\s#="]/.test(value)
      const escaped = needsQuotes ? `"${value.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"` : value
      return `${key}=${escaped}`
    })
    .join('\n')
}
