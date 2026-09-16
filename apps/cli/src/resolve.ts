import type { Collection, Environment, Workspace } from '@vayntforge/engine'

/** Exact id match first, then a case-insensitive name match — errors clearly on zero or ambiguous (>1) name matches. */
function findByIdOrName<T extends { id: string; name: string }>(items: T[], nameOrId: string, kind: string): T {
  const byId = items.find((i) => i.id === nameOrId)
  if (byId) return byId
  const lower = nameOrId.toLowerCase()
  const byName = items.filter((i) => i.name.toLowerCase() === lower)
  if (byName.length === 1) return byName[0]!
  if (byName.length > 1) {
    throw new Error(`Multiple ${kind}s named "${nameOrId}" — use its id instead: ${byName.map((i) => i.id).join(', ')}`)
  }
  const available = items.map((i) => `${i.name} (${i.id})`).join(', ') || '(none)'
  throw new Error(`No ${kind} matches "${nameOrId}". Available: ${available}`)
}

export function findWorkspace(workspaces: Workspace[], nameOrId: string): Workspace {
  return findByIdOrName(workspaces, nameOrId, 'workspace')
}

export function findCollection(collections: Collection[], nameOrId: string): Collection {
  return findByIdOrName(collections, nameOrId, 'collection')
}

export function findEnvironment(environments: Environment[], nameOrId: string): Environment {
  return findByIdOrName(environments, nameOrId, 'environment')
}
