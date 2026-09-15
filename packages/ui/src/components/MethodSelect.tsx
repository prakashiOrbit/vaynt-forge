import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { MethodBadge } from './StatusBadge'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
export type MethodSelectValue = (typeof METHODS)[number]

export interface MethodSelectProps {
  value: string
  onChange(method: MethodSelectValue): void
}

/** Compact HTTP method dropdown, colour-coded via {@link MethodBadge}. */
export function MethodSelect({ value, onChange }: MethodSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-bg-input px-2.5 hover:border-border-strong"
      >
        <MethodBadge method={value} />
        <ChevronDown className="h-3 w-3 text-faint" />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute top-full left-0 z-20 mt-1 w-32 overflow-hidden rounded-md border border-border bg-overlay py-1 shadow-2xl"
        >
          {METHODS.map((m) => (
            <li key={m}>
              <button
                type="button"
                role="option"
                aria-selected={m === value}
                onClick={() => {
                  onChange(m)
                  setOpen(false)
                }}
                className={`flex w-full items-center px-2.5 py-1.5 hover:bg-bg-hover ${
                  m === value ? 'bg-bg-active' : ''
                }`}
              >
                <MethodBadge method={m} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
