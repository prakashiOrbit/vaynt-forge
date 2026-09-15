import { useMemo, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'

export interface VariableInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange(value: string): void
  /** Variable names offered after typing `{{` — no braces, e.g. `api_url`, `$guid`. */
  suggestions?: string[]
  /**
   * Chrome + sizing for the wrapper (height/border/bg/font/flex). The
   * component deliberately carries no `flex-*`/`w-*` of its own — pass a
   * standard-scale Tailwind class (`flex-1`, `w-48`, …) here for the size you
   * want; a duplicated/conflicting flex class between this component and the
   * caller was exactly the bug that motivated this. Prefer non-arbitrary
   * utilities — an arbitrary `flex-[n]` may silently fail to compile at all.
   */
}

const TOKEN_RE = /(\{\{[^{}]*\}\})/g
const NBSP = String.fromCharCode(160)

function renderTokens(value: string) {
  const parts = value.split(TOKEN_RE)
  return parts.map((part, i) =>
    TOKEN_RE.test(part) ? (
      <span key={i} className="text-accent-2">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

/** Finds an unterminated `{{partial` ending at `caret`, if the cursor is inside one. */
function activeBraceQuery(value: string, caret: number): { start: number; query: string } | null {
  const upToCaret = value.slice(0, caret)
  const openIdx = upToCaret.lastIndexOf('{{')
  if (openIdx === -1) return null
  const closedAfterOpen = upToCaret.indexOf('}}', openIdx)
  if (closedAfterOpen !== -1) return null
  return { start: openIdx, query: upToCaret.slice(openIdx + 2) }
}

/**
 * Single-line input that highlights `{{variable}}` tokens and offers autocomplete.
 *
 * Renders two `absolute inset-0` layers sharing identical padding — a colored,
 * non-interactive overlay and a fully transparent native `<input>` on top. Both
 * layers get the exact same box regardless of the wrapper's own chrome classes,
 * so there's no contentEditable caret-restoration fragility and no risk of the
 * overlay and the real input drifting out of alignment.
 */
export function VariableInput({
  value,
  onChange,
  suggestions = [],
  className = '',
  onKeyDown,
  style,
  ...props
}: VariableInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const query = useMemo(() => {
    const caret = inputRef.current?.selectionStart ?? value.length
    return activeBraceQuery(value, caret)
  }, [value])

  const matches = useMemo(() => {
    if (!query) return []
    const q = query.query.toLowerCase()
    return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 8)
  }, [query, suggestions])

  const showDropdown = open && query !== null && matches.length > 0

  const applySuggestion = (name: string) => {
    if (!query) return
    const caret = inputRef.current?.selectionStart ?? value.length
    const next = `${value.slice(0, query.start)}{{${name}}}${value.slice(caret)}`
    onChange(next)
    setOpen(false)
    requestAnimationFrame(() => {
      const pos = query.start + name.length + 4
      inputRef.current?.setSelectionRange(pos, pos)
      inputRef.current?.focus()
    })
  }

  // A password-type field must never leak its plaintext into the overlay —
  // masked dots stand in for the real value instead of colored tokens.
  const masked = props.type === 'password'

  return (
    <div className={`relative min-w-0 overflow-hidden focus-within:ring-2 focus-within:ring-accent ${className}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-2 whitespace-pre"
      >
        {masked ? '•'.repeat(value.length) || NBSP : value ? renderTokens(value) : NBSP}
      </div>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHighlight(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (showDropdown) {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setHighlight((h) => Math.min(h + 1, matches.length - 1))
              return
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              setHighlight((h) => Math.max(h - 1, 0))
              return
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault()
              const picked = matches[highlight]
              if (picked) applySuggestion(picked)
              return
            }
            if (e.key === 'Escape') {
              setOpen(false)
              return
            }
          }
          onKeyDown?.(e)
        }}
        className="absolute inset-0 w-full bg-transparent px-2 outline-none"
        // Tailwind never emits `.text-transparent`/`.caret-text` here — this file's
        // JIT scan only produces color utilities for tokens that already appear
        // verbatim as a `text-`/`caret-` candidate elsewhere in the scanned
        // sources, and neither the built-in `transparent` keyword nor a
        // `caret-*` variant of our custom tokens does. Inline style sidesteps
        // that entirely and is what actually makes the input's real text
        // invisible (only the colored overlay should read as visible text).
        style={{ ...style, color: 'transparent', caretColor: 'var(--af-text)' }}
        {...props}
      />
      {showDropdown && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-20 mt-1 max-h-48 w-max min-w-[160px] overflow-y-auto rounded-md border border-border bg-overlay py-1 text-[12px] shadow-2xl"
        >
          {matches.map((m, i) => (
            <li key={m}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault()
                  applySuggestion(m)
                }}
                className={`flex w-full items-center px-2.5 py-1.5 font-mono text-[11px] ${
                  i === highlight ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
                }`}
              >
                {m}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
