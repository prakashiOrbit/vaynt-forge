import { createContext, useContext } from 'react'
import type { MouseEvent } from 'react'
import type { NodeApi } from 'react-arborist'
import type { RequestModel } from '@vayntforge/engine'
import type { TreeNode } from '../../lib/collectionTree'

export interface TreeActions {
  onOpenRequest(request: RequestModel): void
  onContextMenu(e: MouseEvent, node: NodeApi<TreeNode>): void
}

/**
 * Passes row actions into the react-arborist Node renderer without redefining
 * that component on every render (which would remount the whole tree — bad
 * for in-progress drag/edit state). TreeNodeRow must stay a stable top-level
 * component; this context is how it reaches CollectionsPage's callbacks.
 */
export const TreeActionsContext = createContext<TreeActions | null>(null)

export function useTreeActions(): TreeActions {
  const ctx = useContext(TreeActionsContext)
  if (!ctx) throw new Error('useTreeActions must be used within TreeActionsContext.Provider')
  return ctx
}
