import { useEffect } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '../stores/toast'

const ICONS = {
  info: <Info className="h-4 w-4 text-[var(--af-info)]" />,
  success: <CheckCircle2 className="h-4 w-4 text-[var(--af-ok)]" />,
  error: <XCircle className="h-4 w-4 text-[var(--af-err)]" />,
}

function ToastItem({ id, tone, title, message }: { id: number; tone: 'info' | 'success' | 'error'; title: string; message?: string }) {
  const dismiss = useToastStore((s) => s.dismiss)

  useEffect(() => {
    const t = window.setTimeout(() => dismiss(id), 4000)
    return () => window.clearTimeout(t)
  }, [id, dismiss])

  return (
    <div
      role="status"
      className="anim-slide-in-right flex w-full max-w-sm items-start gap-2.5 rounded-lg border border-border bg-overlay px-3.5 py-3 shadow-2xl"
    >
      <span className="mt-0.5 shrink-0">{ICONS[tone]}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-semibold text-text">{title}</div>
        {message && <div className="mt-0.5 text-[11px] leading-relaxed text-muted">{message}</div>}
      </div>
      <button
        onClick={() => dismiss(id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-0.5 text-faint transition-colors hover:text-text"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-[80] flex w-full max-w-sm flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem id={t.id} tone={t.tone} title={t.title} message={t.message} />
        </div>
      ))}
    </div>
  )
}