import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface JsonTreeViewProps {
  data: unknown
  /** Depth at which nodes start collapsed — keeps a huge payload cheap to first-render. */
  defaultExpandDepth?: number
}

type JsonValue = unknown

function typeOf(value: JsonValue): 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value as 'string' | 'number' | 'boolean' | 'object'
}

function isContainer(value: JsonValue): value is Record<string, unknown> | unknown[] {
  const t = typeOf(value)
  return t === 'object' || t === 'array'
}

/** Paths (dot-joined) whose subtree contains a match — used to auto-expand search hits. */
function findMatchPaths(value: JsonValue, query: string, path: string, out: Set<string>): boolean {
  if (!query) return false
  let selfMatch = false
  if (isContainer(value)) {
    const entries = Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value)
    for (const [key, child] of entries) {
      const childPath = path ? `${path}.${key}` : key
      const keyMatches = key.toLowerCase().includes(query)
      const childMatches = findMatchPaths(child, query, childPath, out)
      if (keyMatches || childMatches) selfMatch = true
    }
  } else {
    selfMatch = String(value).toLowerCase().includes(query)
  }
  if (selfMatch && path) out.add(path)
  return selfMatch
}

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const idx = text.toLowerCase().indexOf(query)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-accent/30 text-text">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function ValuePreview({ value, query }: { value: JsonValue; query: string }) {
  const t = typeOf(value)
  if (t === 'string') return <span className="text-ok">"<Highlight text={value as string} query={query} /></span>
  if (t === 'number') return <span className="text-accent-2">{String(value)}</span>
  if (t === 'boolean') return <span className="text-warn">{String(value)}</span>
  if (t === 'null') return <span className="text-faint">null</span>
  return null
}

interface NodeProps {
  label: string | null
  value: JsonValue
  depth: number
  defaultExpandDepth: number
  expandSignal: number
  collapseSignal: number
  forceExpandPaths: Set<string>
  path: string
  query: string
}

function JsonNode({
  label,
  value,
  depth,
  defaultExpandDepth,
  expandSignal,
  collapseSignal,
  forceExpandPaths,
  path,
  query,
}: NodeProps) {
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth || forceExpandPaths.has(path))
  const [lastExpandSignal, setLastExpandSignal] = useState(expandSignal)
  const [lastCollapseSignal, setLastCollapseSignal] = useState(collapseSignal)

  if (expandSignal !== lastExpandSignal) {
    setLastExpandSignal(expandSignal)
    if (!expanded) setExpanded(true)
  }
  if (collapseSignal !== lastCollapseSignal) {
    setLastCollapseSignal(collapseSignal)
    if (expanded) setExpanded(false)
  }
  if (query && forceExpandPaths.has(path) && !expanded) setExpanded(true)

  const container = isContainer(value)
  const entries = useMemo(() => {
    if (!container) return []
    return Array.isArray(value) ? value.map((v, i) => [String(i), v] as const) : Object.entries(value)
  }, [container, value])

  const summary = Array.isArray(value) ? `Array(${entries.length})` : `Object(${entries.length})`

  return (
    <div>
      <div className="flex items-start gap-1 py-0.5 font-mono text-[12px] leading-relaxed">
        {container ? (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-0.5 shrink-0 rounded text-faint hover:text-text"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-3 shrink-0" />
        )}
        {label !== null && (
          <span className="shrink-0 text-accent">
            <Highlight text={label} query={query} />:
          </span>
        )}
        {container ? (
          <span className="text-faint">
            {Array.isArray(value) ? '[' : '{'}
            {!expanded && <span className="mx-1 text-faint">{summary}</span>}
            {!expanded && (Array.isArray(value) ? ']' : '}')}
          </span>
        ) : (
          <ValuePreview value={value} query={query} />
        )}
      </div>
      {container && expanded && (
        <div className="ml-4 border-l border-border pl-2">
          {entries.length === 0 ? (
            <div className="py-0.5 text-[12px] text-faint">(empty)</div>
          ) : (
            entries.map(([key, child]) => (
              <JsonNode
                key={key}
                label={key}
                value={child}
                depth={depth + 1}
                defaultExpandDepth={defaultExpandDepth}
                expandSignal={expandSignal}
                collapseSignal={collapseSignal}
                forceExpandPaths={forceExpandPaths}
                path={path ? `${path}.${key}` : key}
                query={query}
              />
            ))
          )}
          <div className="py-0.5 text-[12px] text-faint">{Array.isArray(value) ? ']' : '}'}</div>
        </div>
      )}
    </div>
  )
}

/**
 * Renders arbitrary JSON as a lazily-expanded tree. Nodes past
 * `defaultExpandDepth` start collapsed (showing only an `Object(N)` /
 * `Array(N)` summary), so a huge payload never forces thousands of DOM nodes
 * into existence on first render — only "Expand all" does, and even then
 * each node is a small handful of `<span>`s, not a heavy component.
 */
export function JsonTreeView({ data, defaultExpandDepth = 1 }: JsonTreeViewProps) {
  const [expandSignal, setExpandSignal] = useState(0)
  const [collapseSignal, setCollapseSignal] = useState(0)
  const [query, setQuery] = useState('')

  const forceExpandPaths = useMemo(() => {
    const out = new Set<string>()
    const q = query.trim().toLowerCase()
    if (q) findMatchPaths(data, q, '', out)
    return out
  }, [data, query])

  const copyAll = () => {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2))
  }
  const downloadAll = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'response.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search keys/values…"
          className="h-6 w-40 rounded border border-border bg-bg-input px-2 text-[11px] text-text outline-none placeholder:text-faint focus:border-accent"
        />
        <button onClick={() => setExpandSignal((s) => s + 1)} className="text-[11px] text-accent hover:underline">
          Expand all
        </button>
        <button onClick={() => setCollapseSignal((s) => s + 1)} className="text-[11px] text-accent hover:underline">
          Collapse all
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={copyAll} className="text-[11px] text-muted hover:text-text">
            Copy
          </button>
          <button onClick={downloadAll} className="text-[11px] text-muted hover:text-text">
            Download
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <JsonNode
          label={null}
          value={data}
          depth={0}
          defaultExpandDepth={defaultExpandDepth}
          expandSignal={expandSignal}
          collapseSignal={collapseSignal}
          forceExpandPaths={forceExpandPaths}
          path=""
          query={query.trim().toLowerCase()}
        />
      </div>
    </div>
  )
}
