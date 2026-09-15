import type { RequestModel } from '@vayntforge/engine'

export interface RequestPanelProps {
  draft: RequestModel
  update(updater: (draft: RequestModel) => RequestModel): void
  /** Variable names offered for `{{...}}` autocomplete. */
  suggestions: string[]
}
