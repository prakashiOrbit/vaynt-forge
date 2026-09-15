import { KeyValueEditor } from '@vayntforge/ui'
import type { RequestPanelProps } from './types'

export function HeadersPanel({ draft, update, suggestions }: RequestPanelProps) {
  return (
    <div className="p-3">
      <KeyValueEditor
        rows={draft.headers}
        onChange={(headers) => update((d) => ({ ...d, headers }))}
        keyPlaceholder="Header"
        valuePlaceholder="Value"
        allowSecret
        valueSuggestions={suggestions}
        newRowLabel="Add header"
      />
    </div>
  )
}
