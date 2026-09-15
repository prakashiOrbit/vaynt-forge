import { useState } from 'react'
import { Check, Monitor, Moon, Sun } from 'lucide-react'
import { useSession } from '../stores/session'

const OPTIONS = [
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'system', label: 'System', icon: Monitor },
] as const

type ThemeValue = (typeof OPTIONS)[number]['value']

function currentIcon(theme: ThemeValue) {
  return OPTIONS.find((o) => o.value === theme)?.icon ?? Monitor
}

export function ThemeToggle() {
  const [open, setOpen] = useState(false)
  const theme = useSession((s) => s.theme)
  const setTheme = useSession((s) => s.setTheme)
  const Icon = currentIcon(theme)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Theme"
        aria-expanded={open}
        className="rounded p-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text"
      >
        <Icon className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-overlay py-1 shadow-2xl">
            <div className="px-3 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Theme
            </div>
            {OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setTheme(opt.value)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] text-muted transition-colors hover:bg-bg-hover hover:text-text"
              >
                <opt.icon className="h-3.5 w-3.5" />
                <span className="flex-1">{opt.label}</span>
                {theme === opt.value && <Check className="h-3.5 w-3.5 text-accent" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}