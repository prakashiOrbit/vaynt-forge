import { createContext, useContext } from 'react'

export interface MenuItem {
  label?: string
  icon?: React.ReactNode
  shortcut?: string
  disabled?: boolean
  danger?: boolean
  separator?: boolean
  onSelect?(): void
}

export interface ContextMenuValue {
  openContextMenu(e: React.MouseEvent, items: MenuItem[]): void
}

export const ContextMenuContext = createContext<ContextMenuValue>({
  openContextMenu: () => {},
})

export function useContextMenu() {
  return useContext(ContextMenuContext)
}