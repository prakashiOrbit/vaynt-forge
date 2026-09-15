import { useEffect, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Layers } from 'lucide-react'
import { ConfirmDialog } from '@vayntforge/ui'
import type { Environment } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData } from '../stores/data'

export function EnvironmentSelector() {
  const [open, setOpen] = useState(false)
  const [pendingProd, setPendingProd] = useState<Environment | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const activeId = useSession((s) => s.activeEnvironmentId)
  const setActiveEnvironment = useSession((s) => s.setActiveEnvironment)

  const environments = useActiveWorkspaceData().environments

  const active = environments.find((e) => e.id === activeId)

  useEffect(() => {
    if (environments.length > 0 && !environments.some((e) => e.id === activeId)) {
      setActiveEnvironment(environments[0]!.id)
    } else if (environments.length === 0 && activeId !== '') {
      setActiveEnvironment('')
    }
  }, [environments, activeId, setActiveEnvironment])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 items-center gap-2 rounded-md border px-2.5 text-[12px] transition-colors ${
          active?.isProduction
            ? 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
            : 'border-border text-muted hover:bg-bg-hover hover:text-text'
        }`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Layers className="h-3.5 w-3.5" />
        <span>{active?.name ?? 'No Environment'}</span>
        <ChevronsUpDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 w-56 rounded-md border border-border bg-overlay py-1 shadow-xl"
        >
          {environments.length === 0 && (
            <div className="px-3 py-2 text-[12px] text-faint">No environments in this workspace</div>
          )}
          {environments.map((env) => (
            <button
              key={env.id}
              role="option"
              aria-selected={env.id === activeId}
              onClick={() => {
                if (env.isProduction && env.id !== activeId) {
                  setPendingProd(env)
                } else {
                  setActiveEnvironment(env.id)
                }
                setOpen(false)
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-bg-hover hover:text-text"
            >
              <span className="flex-1 truncate">{env.name}</span>
              {env.isProduction && (
                <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-400">
                  Prod
                </span>
              )}
              {env.id === activeId && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pendingProd !== null}
        title="Switch to Production?"
        description={`Requests sent from here will run against "${pendingProd?.name}" — a real production environment.`}
        confirmLabel="Switch anyway"
        tone="danger"
        onConfirm={() => {
          if (pendingProd) setActiveEnvironment(pendingProd.id)
          setPendingProd(null)
        }}
        onCancel={() => setPendingProd(null)}
      />
    </div>
  )
}