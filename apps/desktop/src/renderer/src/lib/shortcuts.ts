import { useEffect, useRef } from 'react'

export type Mod = 'cmd' | 'alt' | 'shift'

export interface ShortcutOptions {
  allowInInputs?: boolean
}

function matches(e: KeyboardEvent, mods: Mod[], key: string): boolean {
  if (e.altKey !== mods.includes('alt')) return false
  if (e.shiftKey !== mods.includes('shift')) return false
  const cmd = mods.includes('cmd')
  if (cmd && !(e.metaKey || e.ctrlKey)) return false
  if (!cmd && (e.metaKey || e.ctrlKey)) return false
  if (e.key.toLowerCase() !== key.toLowerCase()) return false
  return true
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT' ||
    target.isContentEditable
  )
}

export function useKeyboardShortcut(
  mods: Mod[],
  key: string,
  handler: (e: KeyboardEvent) => void,
  opts: ShortcutOptions = {}
) {
  const { allowInInputs = false } = opts
  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!allowInInputs && e.key.toLowerCase() !== 'escape' && isEditableTarget(e.target)) return
      if (matches(e, mods, key)) handlerRef.current(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mods.join(','), key, allowInInputs])
}