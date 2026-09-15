import { CodeEditor } from '@vayntforge/ui'
import type { RequestPanelProps } from './types'

export function ScriptsPanel({ draft, update }: RequestPanelProps) {
  const scripts = draft.scripts
  return (
    <div className="space-y-4 p-3">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-faint">Pre-request Script</label>
          <span className="text-[10px] text-faint">Runs in the isolated-vm sandbox (Sprint 6)</span>
        </div>
        <CodeEditor
          value={scripts.preRequest}
          onChange={(preRequest) => update((d) => ({ ...d, scripts: { ...d.scripts, preRequest } }))}
          language="javascript"
          minHeight="140px"
          placeholder="// e.g. pm.environment.set('token', pm.response.json().token)"
        />
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-faint">Post-response Script</label>
          <span className="text-[10px] text-faint">Runs in the isolated-vm sandbox (Sprint 6)</span>
        </div>
        <CodeEditor
          value={scripts.postResponse}
          onChange={(postResponse) => update((d) => ({ ...d, scripts: { ...d.scripts, postResponse } }))}
          language="javascript"
          minHeight="140px"
        />
      </div>
    </div>
  )
}
