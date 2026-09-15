import { useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface TooltipProps {
  label: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom'
  delay?: number
}

export function Tooltip({ label, children, side = 'top', delay = 450 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)
  const id = useId()

  const show = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setVisible(true), delay)
  }
  const hide = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setVisible(false)
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocusCapture={show}
      onBlurCapture={hide}
      aria-describedby={visible ? id : undefined}
    >
      {children}
      {visible && (
        <span
          id={id}
          role="tooltip"
          className={`anim-fade-in pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 rounded border border-border bg-overlay px-2 py-1 whitespace-nowrap text-[11px] font-normal text-text shadow-lg ${
            side === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
        >
          {label}
        </span>
      )}
    </span>
  )
}