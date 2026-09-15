import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { ContextMenuContext, type MenuItem } from './context-menu-context'

interface ContextMenuState {
  x: number
  y: number
  items: MenuItem[]
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ContextMenuState | null>(null)
  const [clamped, setClamped] = useState({ x: 0, y: 0 })
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setState(null), [])

  const openContextMenu = useCallback((e: React.MouseEvent, items: MenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setClamped({ x: e.clientX, y: e.clientY })
    setState({ x: e.clientX, y: e.clientY, items })
  }, [])

  useEffect(() => {
    if (!state) return
    const frame = requestAnimationFrame(() => {
      const el = menuRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setClamped((c) => ({
        x: Math.min(c.x, Math.max(4, window.innerWidth - r.width - 6)),
        y: Math.min(c.y, Math.max(4, window.innerHeight - r.height - 6)),
      }))
    })
    return () => cancelAnimationFrame(frame)
  }, [state])

  useEffect(() => {
    if (!state) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const onPointerDown = (e: PointerEvent) => {
      const el = menuRef.current
      if (el && !el.contains(e.target as Node)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [state, close])

  return (
    <ContextMenuContext.Provider value={{ openContextMenu }}>
      {children}
      {state &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="anim-pop fixed z-[70] min-w-[190px] max-w-[260px] rounded-md border border-border bg-overlay py-1 shadow-2xl"
            style={{ left: clamped.x, top: clamped.y }}
          >
            {state.items.map((item, i) =>
              item.separator ? (
                <div key={i} className="my-1 h-px bg-border" />
              ) : (
                <button
                  key={i}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    close()
                    item.onSelect?.()
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors disabled:pointer-events-none disabled:opacity-40 ${
                    item.danger ? 'text-[var(--af-err)] hover:bg-red-500/10' : 'text-text hover:bg-bg-hover'
                  }`}
                >
                  {item.icon && (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">{item.icon}</span>
                  )}
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.shortcut && (
                    <kbd className="rounded border border-border bg-raised px-1 py-px font-mono text-[10px] text-faint">
                      {item.shortcut}
                    </kbd>
                  )}
                </button>
              )
            )}
          </div>,
          document.body
        )}
    </ContextMenuContext.Provider>
  )
}