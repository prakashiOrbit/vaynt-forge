import type { Collection, Folder, RequestModel } from '@vayntforge/engine'

export type TreeNodeKind = 'collection' | 'folder' | 'request'

export interface TreeNode {
  id: string
  name: string
  kind: TreeNodeKind
  method?: string
  /** Only present for kind 'request' — the underlying request. */
  request?: RequestModel
  /** Only present for kind 'collection' — the underlying collection. */
  collection?: Collection
  /** Only present for kind 'folder' — the underlying folder. */
  folder?: Folder
  children?: TreeNode[]
}

export const UNFILED_ID = '__unfiled__'

/**
 * Builds a nested tree for react-arborist from the flat store shape.
 *
 * Membership is `request.folderId` / `request.collectionId` and
 * `folder.parentFolderId` — the single source of truth this UI uses.
 * `Folder.requestIds` (an ordering hint some storage layers also carry) is
 * intentionally not consulted: keeping two membership lists in sync on every
 * drag-drop move is real extra bookkeeping for a benefit ("remembers exact
 * manual order") that isn't an acceptance criterion here. Order falls back
 * to whatever order the snapshot returns.
 */
export function buildTree(
  collections: Collection[],
  foldersByCollection: Record<string, Folder[]>,
  requests: RequestModel[]
): TreeNode[] {
  const requestsByFolder = new Map<string, RequestModel[]>()
  const requestsByCollectionRoot = new Map<string, RequestModel[]>()
  const unfiledRequests: RequestModel[] = []

  for (const r of requests) {
    if (r.folderId) {
      requestsByFolder.set(r.folderId, [...(requestsByFolder.get(r.folderId) ?? []), r])
    } else if (r.collectionId) {
      requestsByCollectionRoot.set(r.collectionId, [...(requestsByCollectionRoot.get(r.collectionId) ?? []), r])
    } else {
      unfiledRequests.push(r)
    }
  }

  function requestNode(r: RequestModel): TreeNode {
    return { id: r.id, name: r.name, kind: 'request', method: r.method, request: r }
  }

  function folderNode(folder: Folder, allFolders: Folder[]): TreeNode {
    const subFolders = allFolders.filter((f) => f.parentFolderId === folder.id)
    const children: TreeNode[] = [
      ...subFolders.map((f) => folderNode(f, allFolders)),
      ...(requestsByFolder.get(folder.id) ?? []).map(requestNode),
    ]
    return { id: folder.id, name: folder.name, kind: 'folder', folder, children }
  }

  const collectionNodes: TreeNode[] = collections.map((c) => {
    const folders = foldersByCollection[c.id] ?? []
    const topFolders = folders.filter((f) => !f.parentFolderId)
    const children: TreeNode[] = [
      ...topFolders.map((f) => folderNode(f, folders)),
      ...(requestsByCollectionRoot.get(c.id) ?? []).map(requestNode),
    ]
    return { id: c.id, name: c.name, kind: 'collection', collection: c, children }
  })

  if (unfiledRequests.length > 0) {
    collectionNodes.push({
      id: UNFILED_ID,
      name: 'Unfiled',
      kind: 'collection',
      children: unfiledRequests.map(requestNode),
    })
  }

  return collectionNodes
}

/** Flattens a tree back to `{id, kind}` for quick lookups (e.g. after a move). */
export function flattenIds(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (list: TreeNode[]) => {
    for (const n of list) {
      out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}
