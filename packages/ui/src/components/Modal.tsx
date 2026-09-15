import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useDialogFocus } from '../hooks/useDialogFocus'

export interface ModalProps {
  open: boolean
  onClose(): void
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: string
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-md' }: ModalProps) {
  const containerRef = useDialogFocus(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="anim-fade-in absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`anim-zoom-in relative w-full ${width} overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl outline-none`}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-[13px] font-semibold text-text">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded p-1 text-faint transition-colors hover:text-text"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="px-4 py-3.5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border bg-raised px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}