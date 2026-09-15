import { KeyValueEditor } from '@vayntforge/ui'
import type { RequestPanelProps } from './types'

export function ParamsPanel({ draft, update, suggestions }: RequestPanelProps) {
  return (
    <div className="p-3">
      <KeyValueEditor
        rows={draft.params}
        onChange={(params) => update((d) => ({ ...d, params }))}
        keyPlaceholder="Param"
        valuePlaceholder="Value"
        valueSuggestions={suggestions}
        newRowLabel="Add param"
      />
    </div>
  )
}
