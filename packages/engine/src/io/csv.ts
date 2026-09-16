/**
 * RFC 4180 tokenizer: splits CSV text into rows of raw string fields,
 * handling quoted fields (embedded commas/newlines, `""` as an escaped
 * quote) and both `\n` and `\r\n` line endings.
 */
function tokenizeCsv(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < content.length) {
    const c = content[i]
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += c
      i += 1
      continue
    }
    if (c === '"') {
      inQuotes = true
      i += 1
      continue
    }
    if (c === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }
    if (c === '\r') {
      i += 1
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
      continue
    }
    field += c
    i += 1
  }
  row.push(field)
  rows.push(row)
  return rows
}

/**
 * Parses a CSV file (first row = column headers) into one plain object per
 * data row, keyed by header name — the Collection Runner's per-iteration
 * data-file shape, matching what its existing JSON-array format already
 * produces.
 */
export function parseCsv(content: string): Record<string, string>[] {
  const rows = tokenizeCsv(content).filter((row) => !(row.length === 1 && row[0] === ''))
  if (rows.length === 0) return []
  const [headerRow, ...dataRows] = rows
  const header = (headerRow ?? []).map((h) => h.trim())
  return dataRows.map((row) => {
    const obj: Record<string, string> = {}
    header.forEach((key, i) => {
      if (key) obj[key] = row[i] ?? ''
    })
    return obj
  })
}
