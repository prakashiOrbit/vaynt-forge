import type { AuthConfig } from '../types/request.js'
import type { Collection, Folder } from '../types/workspace.js'

/** A request's resolved ancestry: its collection (if any) and the folder chain from outermost to innermost. */
export interface AncestorChain {
  collection?: Collection
  /** Outermost folder first, the request's own immediate parent folder last. */
  folders: Folder[]
}

/** Walks `folderId` up through `parentFolderId` to the collection root. Missing/dangling ids just stop the walk rather than throwing. */
export function resolveAncestorChain(
  request: { collectionId?: string; folderId?: string },
  collections: Collection[],
  foldersByCollection: Record<string, Folder[]>
): AncestorChain {
  if (!request.collectionId) return { folders: [] }
  const collection = collections.find((c) => c.id === request.collectionId)
  const allFolders = foldersByCollection[request.collectionId] ?? []
  const folders: Folder[] = []
  let current = request.folderId ? allFolders.find((f) => f.id === request.folderId) : undefined
  while (current) {
    folders.unshift(current)
    current = current.parentFolderId ? allFolders.find((f) => f.id === current!.parentFolderId) : undefined
  }
  return { collection, folders }
}

/**
 * Resolves `{type:'inherit'}` to a concrete `AuthConfig` — the nearest
 * ancestor (innermost folder first, walking out to the collection) that has
 * its own non-inherit auth set, or `{type:'none'}` if nothing in the chain
 * does. A concrete (non-inherit) `auth` is returned unchanged.
 */
export function resolveEffectiveAuth(auth: AuthConfig, chain: AncestorChain): AuthConfig {
  if (auth.type !== 'inherit') return auth
  for (let i = chain.folders.length - 1; i >= 0; i--) {
    const folderAuth = chain.folders[i]?.auth
    if (folderAuth && folderAuth.type !== 'inherit') return folderAuth
  }
  if (chain.collection?.auth && chain.collection.auth.type !== 'inherit') return chain.collection.auth
  return { type: 'none' }
}

/** Collection-level variables only (matching Postman's model — folders don't carry their own variable scope), as plain key/value pairs ready for `collectVariables`'s `collection` scope. */
export function resolveCollectionVariables(chain: AncestorChain): { key: string; value: string }[] {
  return (chain.collection?.variables ?? []).map((v) => ({ key: v.key, value: v.currentValue }))
}

/** Ancestor scripts in execution order (collection, then each folder outermost→innermost) — the caller appends the request's own script after each list. Same order for both phases, matching Postman. */
export function resolveAncestorScripts(chain: AncestorChain): { preRequest: string[]; postResponse: string[] } {
  const preRequest: string[] = []
  const postResponse: string[] = []
  const collect = (scripts: { preRequest: string; postResponse: string } | undefined) => {
    if (scripts?.preRequest?.trim()) preRequest.push(scripts.preRequest)
    if (scripts?.postResponse?.trim()) postResponse.push(scripts.postResponse)
  }
  collect(chain.collection?.scripts)
  for (const folder of chain.folders) collect(folder.scripts)
  return { preRequest, postResponse }
}
