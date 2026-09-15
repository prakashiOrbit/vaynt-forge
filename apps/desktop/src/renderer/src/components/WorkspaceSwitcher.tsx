import { useEffect, useState } from 'react'
import {
  Check,
  ChevronDown,
  Copy,
  Download,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { ConfirmDialog, toast } from '@vayntforge/ui'
import type { Workspace } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useData, useWorkspaceById } from '../stores/data'

export function WorkspaceSwitcher() {
  const workspaces = useData((s) => s.workspaces)
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace)

  const createWorkspace = useData((s) => s.createWorkspace)
  const renameWorkspace = useData((s) => s.renameWorkspace)
  const deleteWorkspace = useData((s) => s.deleteWorkspace)

  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleting, setDeleting] = useState<Workspace | null>(null)

  const active = useWorkspaceById(activeWorkspaceId)

  useEffect(() => {
    if (!open) {
      setAdding(false)
      setRenamingId(null)
    }
  }, [open])

  const exportWorkspace = (id: string) => {
    const ws = workspaces.find((w) => w.id === id)
    if (!ws) return
    const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${ws.name.replace(/\s+/g, '-').toLowerCase()}.workspace.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Workspace exported', `${ws.name} was saved as a JSON file.`)
  }

  const submitNew = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const ws = await createWorkspace({ name: trimmed })
      setActiveWorkspace(ws.id)
      toast.success('Workspace created', trimmed)
    } catch {
      toast.error('Workspace creation failed')
    }
    setName('')
    setAdding(false)
    setOpen(false)
  }

  const submitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameWorkspace(renamingId, renameValue.trim())
      toast.success('Workspace renamed')
    }
    setRenamingId(null)
  }

  const selectWorkspace = (id: string) => {
    setActiveWorkspace(id)
    setOpen(false)
  }

  const confirmDelete = async () => {
    if (deleting) {
      const wasActive = deleting.id === activeWorkspaceId
      await deleteWorkspace(deleting.id)
      toast.success('Workspace deleted', deleting.name)
      if (wasActive) {
        const next = workspaces.find((w) => w.id !== deleting.id)
        if (next) selectWorkspace(next.id)
      }
    }
    setDeleting(null)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch workspace"
        aria-expanded={open}
        className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted transition-colors hover:bg-bg-hover hover:text-text"
      >
        <LayoutGrid className="h-3.5 w-3.5 text-accent" />
        <span className="max-w-[120px] truncate">{active?.name ?? 'No Workspace'}</span>
        <ChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl">
            <div className="px-3 pt-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-faint">
              Workspaces
            </div>

            <div className="px-1.5 pb-1.5">
              {workspaces.map((ws) => {
                const isActive = ws.id === activeWorkspaceId
                return (
                  <div
                    key={ws.id}
                    className="group relative flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-bg-hover"
                  >
                    {renamingId === ws.id ? (
                      <>
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void submitRename()
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          autoFocus
                          className="h-6 min-w-0 flex-1 rounded border border-accent bg-bg-input px-1.5 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        />
                        <span className="flex items-center gap-0.5 text-faint">
                          <button
                            onClick={() => void submitRename()}
                            aria-label="Confirm rename"
                            className="rounded p-0.5 hover:text-ok"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            aria-label="Cancel rename"
                            className="rounded p-0.5 hover:text-text"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => selectWorkspace(ws.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 text-left"
                        >
                          <LayoutGrid className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-accent' : 'text-faint'}`} />
                          <span className="truncate text-[12px] text-text">{ws.name}</span>
                          {ws.isDemo && (
                            <span className="rounded bg-accent/12 px-1 py-px text-[9px] font-medium uppercase tracking-wide text-accent">
                              Demo
                            </span>
                          )}
                        </button>
                        <span className="flex items-center gap-0.5 text-faint opacity-0 transition-opacity group-hover:opacity-100">
                          {isActive && <Check className="h-3.5 w-3.5 text-accent" />}
                          <button
                            onClick={() => {
                              setRenamingId(ws.id)
                              setRenameValue(ws.name)
                            }}
                            aria-label={`Rename ${ws.name}`}
                            className="rounded p-0.5 hover:text-text"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => {
                              void createWorkspace({ name: `${ws.name} Copy`, description: ws.description }).then(
                                (copy) => {
                                  toast.success('Workspace duplicated', `${ws.name} Copy`)
                                  selectWorkspace(copy.id)
                                  return undefined
                                }
                              )
                            }}
                            aria-label={`Duplicate ${ws.name}`}
                            className="rounded p-0.5 hover:text-text"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => exportWorkspace(ws.id)}
                            aria-label={`Export ${ws.name}`}
                            className="rounded p-0.5 hover:text-text"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => setDeleting(ws)}
                            aria-label={`Delete ${ws.name}`}
                            disabled={workspaces.length <= 1}
                            className="rounded p-0.5 hover:text-err disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      </>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="border-t border-border p-1.5">
              {adding ? (
                <div className="flex items-center gap-1.5 px-1 py-0.5">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submitNew()
                      if (e.key === 'Escape') setAdding(false)
                    }}
                    autoFocus
                    placeholder="Workspace name"
                    className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-bg-input px-2 text-[12px] text-text outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <button
                    onClick={() => void submitNew()}
                    aria-label="Create workspace"
                    className="rounded p-1 text-faint hover:text-ok"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAdding(true)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-muted transition-colors hover:bg-bg-hover hover:text-text"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New Workspace
                </button>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="Delete workspace?"
        description={
          <>
            <strong className="font-medium text-text">{deleting?.name}</strong> and everything inside
            it — collections, requests, environments, and history — will be permanently removed.
            This can't be undone.
          </>
        }
        confirmLabel="Delete workspace"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}