import { useEffect, useState } from 'react'
import { CircleCheck, GitBranch, Terminal } from 'lucide-react'

export function StatusBar() {
  const [ping, setPing] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    window.vayntforge?.app
      .ping()
      .then((p) => {
        if (active) setPing(p)
      })
      .catch(() => {
        if (active) setPing('IPC unavailable')
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <footer className="flex h-6 shrink-0 items-center gap-3 border-t border-border bg-raised px-3 text-[11px] text-faint">
      <div className="flex items-center gap-1.5">
        <GitBranch className="h-3 w-3" />
        <span>Acme API</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Terminal className="h-3 w-3" />
        <span>workspace</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <span className="flex items-center gap-1 text-muted">
          <CircleCheck className="h-3 w-3 text-ok" />
          {ping ? 'engine online' : 'engine…'}
        </span>
        <span>v0.1.0</span>
      </div>
    </footer>
  )
}