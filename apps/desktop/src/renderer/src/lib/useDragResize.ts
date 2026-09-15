import { useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

export interface DragResizeOptions {
  axis: 'x' | 'y'
  min: number
  max: number
  onChange(next: number): void
  /** x: measure from the right edge instead of left. y: measure from the top instead of bottom. */
  invert?: boolean
}

/**
 * Same raw-pointer-events drag-to-resize technique as the Sidebar (Sprint 1):
 * the handle is a child of the panel it resizes, and the panel's own live
 * bounding rect is re-read on every pointermove so no stale layout is cached.
 */
export function useDragResize({ axis, min, max, onChange, invert = false }: DragResizeOptions) {
  const [resizing, setResizing] = useState(false)

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    setResizing(true)
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)

    const onMove = (ev: PointerEvent) => {
      const rect = (handle.parentElement as HTMLElement).getBoundingClientRect()
      const raw =
        axis === 'x'
          ? invert
            ? rect.right - ev.clientX
            : ev.clientX - rect.left
          : invert
            ? ev.clientY - rect.top
            : rect.bottom - ev.clientY
      onChange(Math.round(Math.min(max, Math.max(min, raw))))
    }
    const onUp = () => {
      setResizing(false)
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  return { resizing, onPointerDown }
}
