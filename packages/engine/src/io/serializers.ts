import type { RequestModel } from '../types/request.js'
import type { Environment } from '../types/variables.js'
import { generateId } from '../util/id.js'

/**
 * Import/export serialisers (Sprint 3). Versioned JSON files ready for the
 * import/export screens in later sprints. Fresh ids are minted on deserialize
 * so imports never collide with existing entities.
 */

export interface CollectionFileV1 {
  format: 'vayntforge.collection.v1'
  name: string
  description?: string
  requests: Array<{
    name: string
    method: RequestModel['method']
    url: string
    params: RequestModel['params']
    headers: RequestModel['headers']
    auth: RequestModel['auth']
    body: RequestModel['body']
    scripts: RequestModel['scripts']
    assertions: RequestModel['assertions']
    settings: RequestModel['settings']
    variables: RequestModel['variables']
  }>
}

export interface EnvironmentFileV1 {
  format: 'vayntforge.environment.v1'
  name: string
  phase: Environment['phase']
  isProduction: boolean
  variables: Array<{ key: string; initialValue: string; currentValue: string; secret: boolean }>
}

export function serializeCollection(input: {
  name: string
  description?: string
  requests: RequestModel[]
}): string {
  const file: CollectionFileV1 = {
    format: 'vayntforge.collection.v1',
    name: input.name,
    description: input.description,
    requests: input.requests.map((r) => ({
      name: r.name,
      method: r.method,
      url: r.url,
      params: r.params,
      headers: r.headers,
      auth: r.auth,
      body: r.body,
      scripts: r.scripts,
      assertions: r.assertions,
      settings: r.settings,
      variables: r.variables,
    })),
  }
  return JSON.stringify(file, null, 2)
}

export function deserializeCollectionFile(json: string): CollectionFileV1 {
  const parsed = JSON.parse(json) as Partial<CollectionFileV1>
  if (parsed.format !== 'vayntforge.collection.v1' || !Array.isArray(parsed.requests) || !parsed.name) {
    throw new Error('Unsupported collection file format')
  }
  return parsed as CollectionFileV1
}

/** Convert an imported collection file into `RequestModel`s for a workspace. */
export function requestsFromCollectionFile(
  file: CollectionFileV1,
  workspaceId: string,
  collectionId?: string
): RequestModel[] {
  const now = Date.now()
  return file.requests.map((r) => ({
    id: generateId('req'),
    name: r.name,
    method: r.method,
    url: r.url,
    workspaceId,
    collectionId,
    params: r.params,
    headers: r.headers,
    auth: r.auth,
    body: r.body,
    scripts: r.scripts,
    assertions: r.assertions,
    settings: r.settings,
    variables: r.variables,
    createdAt: now,
    updatedAt: now,
  }))
}

export function serializeEnvironment(env: Environment): string {
  const file: EnvironmentFileV1 = {
    format: 'vayntforge.environment.v1',
    name: env.name,
    phase: env.phase,
    isProduction: env.isProduction,
    variables: env.variables.map((v) => ({
      key: v.key,
      initialValue: v.initialValue,
      currentValue: v.currentValue,
      secret: v.secret,
    })),
  }
  return JSON.stringify(file, null, 2)
}

export function deserializeEnvironmentFile(json: string): EnvironmentFileV1 {
  const parsed = JSON.parse(json) as Partial<EnvironmentFileV1>
  if (parsed.format !== 'vayntforge.environment.v1' || !parsed.name || !Array.isArray(parsed.variables)) {
    throw new Error('Unsupported environment file format')
  }
  return parsed as EnvironmentFileV1
}

export function environmentFromFile(file: EnvironmentFileV1, workspaceId: string): Environment {
  const now = Date.now()
  return {
    id: generateId('env'),
    name: file.name,
    phase: file.phase,
    isProduction: file.isProduction,
    workspaceId,
    variables: file.variables.map((v) => ({
      id: generateId('v'),
      key: v.key,
      initialValue: v.initialValue,
      currentValue: v.currentValue,
      scope: 'environment',
      secret: v.secret,
    })),
    createdAt: now,
    updatedAt: now,
  }
}