import { useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { VariableInput } from './VariableInput'

export interface KeyValueRow {
  id: string
  key: string
  value: string
  enabled: boolean
  secret?: boolean
}

export interface KeyValueEditorProps {
  rows: KeyValueRow[]
  onChange(rows: KeyValueRow[]): void
  keyPlaceholder?: string
  valuePlaceholder?: string
  /** Shows the secret eye-toggle per row (headers/params can carry secrets). */
  allowSecret?: boolean
  /** Variable names offered for `{{...}}` autocomplete in value cells. */
  valueSuggestions?: string[]
  newRowLabel?: string
}

function newRow(): KeyValueRow {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true }
}

// No `w-full` here on purpose: the key cell is a fixed `w-48 shrink-0` and the
// value cell is `flex-1`, both standard Tailwind scale utilities. An earlier
// version used `max-w-[38%]` / `flex-[n]` arbitrary values — Tailwind never
// actually compiled those (no matching CSS rule was emitted), so every row
// silently fell back to default flex sizing and the value cell collapsed to
// a few px. Stick to non-arbitrary flex/width utilities here.
const inputClass =
  'h-7 min-w-0 rounded border border-transparent bg-transparent px-2 text-[12px] text-text outline-none placeholder:text-faint focus:border-accent focus:bg-bg-input'

export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  allowSecret = false,
  valueSuggestions = [],
  newRowLabel = 'Add row',
}: KeyValueEditorProps) {
  const [bulkEdit, setBulkEdit] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const patchRow = (id: string, patch: Partial<KeyValueRow>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  const toBulkText = () =>
    rows
      .map((r) => `${r.enabled ? '' : '# '}${r.key}: ${r.value}`)
      .join('\n')

  const enterBulk = () => {
    setBulkText(toBulkText())
    setBulkEdit(true)
  }

  const applyBulk = () => {
    const next = bulkText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const disabled = line.startsWith('# ')
        const clean = disabled ? line.slice(2) : line
        const idx = clean.indexOf(':')
        const key = idx === -1 ? clean : clean.slice(0, idx).trim()
        const value = idx === -1 ? '' : clean.slice(idx + 1).trim()
        return { id: crypto.randomUUID(), key, value, enabled: !disabled }
      })
    onChange(next)
    setBulkEdit(false)
  }

  if (bulkEdit) {
    return (
      <div className="space-y-2">
        <textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          rows={Math.max(6, rows.length + 1)}
          placeholder={`${keyPlaceholder}: ${valuePlaceholder}`}
          className="w-full resize-y rounded-md border border-border bg-bg-input p-2 font-mono text-[12px] text-text outline-none focus:border-accent"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setBulkEdit(false)}
            className="rounded-md px-2.5 py-1 text-[12px] text-muted hover:text-text"
          >
            Cancel
          </button>
          <button
            onClick={applyBulk}
            className="rounded-md bg-accent px-2.5 py-1 text-[12px] font-medium text-white hover:opacity-90"
          >
            Apply
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-md border border-border">
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-center text-[12px] text-faint">No rows yet.</div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-1 border-b border-border px-1.5 py-1 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => patchRow(row.id, { enabled: e.target.checked })}
                aria-label={row.key ? `Toggle ${row.key}` : 'Toggle row'}
                className="h-3.5 w-3.5 shrink-0 accent-[var(--af-accent)]"
              />
              <input
                value={row.key}
                onChange={(e) => patchRow(row.id, { key: e.target.value })}
                placeholder={keyPlaceholder}
                className={`${inputClass} w-48 shrink-0 font-mono`}
              />
              {valueSuggestions.length > 0 ? (
                <VariableInput
                  value={row.value}
                  onChange={(value) => patchRow(row.id, { value })}
                  suggestions={valueSuggestions}
                  placeholder={valuePlaceholder}
                  type={row.secret ? 'password' : 'text'}
                  className={`${inputClass} flex-1 font-mono focus-within:border-accent focus-within:bg-bg-input`}
                />
              ) : (
                <input
                  value={row.value}
                  onChange={(e) => patchRow(row.id, { value: e.target.value })}
                  placeholder={valuePlaceholder}
                  type={row.secret ? 'password' : 'text'}
                  className={`${inputClass} flex-1 font-mono`}
                />
              )}
              {allowSecret && (
                <button
                  type="button"
                  onClick={() => patchRow(row.id, { secret: !row.secret })}
                  title={row.secret ? 'Reveal value' : 'Mask as secret'}
                  className="shrink-0 rounded p-1 text-faint hover:bg-bg-hover hover:text-text"
                >
                  {row.secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => removeRow(row.id)}
                aria-label="Remove row"
                className="shrink-0 rounded p-1 text-faint hover:bg-bg-hover hover:text-err"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange([...rows, newRow()])}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-accent hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> {newRowLabel}
        </button>
        <button
          type="button"
          onClick={enterBulk}
          className="rounded-md px-2 py-1 text-[12px] text-muted hover:text-text"
        >
          Bulk edit
        </button>
      </div>
    </div>
  )
}
