import { useState } from 'react'
import { generateId } from '@vayntforge/engine'
import type { MockServer } from '@vayntforge/engine'
import { Button } from '@vayntforge/ui'

export interface CreateMockServerWizardProps {
  workspaceId: string
  suggestedPort: number
  onCreate(server: MockServer): void
  onCancel(): void
}

/** Sprint 10 — the Create Mock Server wizard: name + port, endpoints get
 * added afterwards via the Mock Response Designer. */
export function CreateMockServerWizard({ workspaceId, suggestedPort, onCreate, onCancel }: CreateMockServerWizardProps) {
  const [name, setName] = useState('New Mock Server')
  const [port, setPort] = useState(suggestedPort)

  const handleCreate = () => {
    const now = Date.now()
    onCreate({
      id: generateId('mock'),
      name: name.trim() || 'New Mock Server',
      workspaceId,
      port,
      status: 'stopped',
      latencyMs: 100,
      endpoints: [],
      log: [],
      createdAt: now,
      updatedAt: now,
    })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-faint">Name</div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          className="h-8 w-full rounded border border-border bg-bg-input px-2 text-[13px] text-text"
        />
      </div>
      <div>
        <div className="mb-1.5 text-[11px] font-semibold uppercase text-faint">Port</div>
        <input
          type="number"
          value={port}
          onChange={(e) => setPort(Math.max(1, Math.min(65535, Number(e.target.value) || 0)))}
          className="h-8 w-32 rounded border border-border bg-bg-input px-2 font-mono text-[13px] text-text"
        />
        <div className="mt-1 text-[11px] text-faint">Will serve at http://localhost:{port}</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!name.trim() || !port}>
          Create
        </Button>
      </div>
    </div>
  )
}
