import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDialogFocus } from '../hooks/useDialogFocus'

export interface DrawerProps {
  open: boolean
  onClose(): void
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  side?: 'left' | 'right'
  width?: number
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  width = 320,
}: DrawerProps) {
  const containerRef = useDialogFocus(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="anim-fade-in absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`anim-slide-in-right absolute top-0 bottom-0 ${
          side === 'right' ? 'right-0 border-l' : 'left-0 border-r'
        } flex flex-col border-border bg-overlay shadow-2xl outline-none`}
        style={{ width }}
      >
        {title !== undefined && (
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="rounded p-1 text-faint transition-colors hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-raised px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}