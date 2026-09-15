import type { RequestModel } from '@vayntforge/engine'

export interface RequestPanelProps {
  draft: RequestModel
  update(updater: (draft: RequestModel) => RequestModel): void
  /** Variable names offered for `{{...}}` autocomplete. */
  suggestions: string[]
  /** Resolves `{{variables}}` against the active environment/globals — used by AuthorizationPanel's real OAuth2 token fetch, which needs actual values (Token URL, Client ID/Secret), not the literal template text. */
  resolveTemplate?: (template: string) => string
}
