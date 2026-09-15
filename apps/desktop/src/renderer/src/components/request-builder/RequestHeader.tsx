import { useState } from 'react'
import { Copy, Loader2, MoreHorizontal, Save, Send, Trash2 } from 'lucide-react'
import { Button, ConfirmDialog, MethodSelect, VariableInput, toast, useContextMenu } from '@vayntforge/ui'
import { toCurl } from '../../lib/toCurl'
import type { RequestPanelProps } from './types'

interface RequestHeaderProps extends RequestPanelProps {
  sending: boolean
  onSend(): void
  onSave(): void
  onDuplicate(): void
  onDelete(): void
  isSaved: boolean
  dirty: boolean
}

export function RequestHeader({
  draft,
  update,
  suggestions,
  sending,
  onSend,
  onSave,
  onDuplicate,
  onDelete,
  isSaved,
  dirty,
}: RequestHeaderProps) {
  const { openContextMenu } = useContextMenu()
  const [confirmDelete, setConfirmDelete] = useState(false)

  const openMore = (e: React.MouseEvent) => {
    openContextMenu(e, [
      {
        label: 'Copy as cURL',
        icon: <Copy className="h-3.5 w-3.5" />,
        onSelect: () => {
          void navigator.clipboard.writeText(toCurl(draft))
          toast.success('Copied as cURL')
        },
      },
      { label: 'Duplicate request', icon: <Copy className="h-3.5 w-3.5" />, onSelect: onDuplicate },
      { separator: true },
      {
        label: 'Delete request',
        icon: <Trash2 className="h-3.5 w-3.5" />,
        disabled: !isSaved,
        onSelect: () => setConfirmDelete(true),
      },
    ])
  }

  return (
    <div id="request-header" className="shrink-0 border-b border-border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <input
          value={draft.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          className="min-w-0 flex-1 truncate rounded px-1 text-[13px] font-semibold text-text outline-none focus:bg-bg-input"
        />
        <Button size="sm" variant="ghost" onClick={openMore} aria-label="More actions">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <MethodSelect value={draft.method} onChange={(method) => update((d) => ({ ...d, method }))} />
        <VariableInput
          value={draft.url}
          onChange={(url) => update((d) => ({ ...d, url }))}
          suggestions={suggestions}
          placeholder="https://api.example.com/v1/resource"
          className="h-8 min-w-0 flex-1 rounded-md border border-border bg-bg-input text-[12px] focus-within:border-accent"
        />
        <Button size="md" onClick={onSend} disabled={sending || !draft.url}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {sending ? 'Sending…' : 'Send'}
        </Button>
        <Button size="md" variant="outline" onClick={onSave} disabled={!dirty}>
          <Save className="h-4 w-4" /> Save
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete request?"
        description={`"${draft.name}" will be permanently removed from this workspace.`}
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => {
          setConfirmDelete(false)
          onDelete()
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
