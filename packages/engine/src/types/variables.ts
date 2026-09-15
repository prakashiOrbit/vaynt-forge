export type VariableScope = 'global' | 'environment' | 'collection' | 'request' | 'temporary'

export interface Variable {
  id: string
  key: string
  initialValue: string
  currentValue: string
  scope: VariableScope
  /** Secrets mask everywhere and are encrypted at rest. */
  secret: boolean
  /** Set for global-scoped variables (inline environment variables omit it). */
  workspaceId?: string
}

export type EnvironmentPhase = 'Development' | 'Test' | 'Staging' | 'Production'

export interface Environment {
  id: string
  name: string
  phase: EnvironmentPhase
  /** Production environments trigger safety confirmations for destructive actions. */
  isProduction: boolean
  workspaceId: string
  variables: Variable[]
  createdAt: number
  updatedAt: number
}

/**
 * Resolution map for `{{variable}}` substitution, ordered by priority.
 * Lookup order: request → collection → environment → global.
 */
export interface ResolutionContext {
  global: Map<string, string>
  environment: Map<string, string>
  collection: Map<string, string>
  request: Map<string, string>
}

export interface ResolutionResult {
  value: string
  resolvedKeys: Set<string>
  missingKeys: Set<string>
}