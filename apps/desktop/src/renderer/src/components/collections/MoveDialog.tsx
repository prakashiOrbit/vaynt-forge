import { useState } from 'react'
import { Folder } from 'lucide-react'
import { Button, Modal } from '@vayntforge/ui'
import type { Collection, Folder as FolderModel } from '@vayntforge/engine'

export interface MoveTarget {
  collectionId: string
  folderId?: string
  label: string
  depth: number
}

function buildTargets(collections: Collection[], foldersByCollection: Record<string, FolderModel[]>): MoveTarget[] {
  const targets: MoveTarget[] = []
  for (const c of collections) {
    targets.push({ collectionId: c.id, label: c.name, depth: 0 })
    const folders = foldersByCollection[c.id] ?? []
    const addFolder = (f: FolderModel, depth: number) => {
      targets.push({ collectionId: c.id, folderId: f.id, label: f.name, depth })
      for (const child of folders.filter((x) => x.parentFolderId === f.id)) addFolder(child, depth + 1)
    }
    for (const top of folders.filter((f) => !f.parentFolderId)) addFolder(top, 1)
  }
  return targets
}

export function MoveDialog({
  open,
  onClose,
  collections,
  foldersByCollection,
  onMove,
}: {
  open: boolean
  onClose(): void
  collections: Collection[]
  foldersByCollection: Record<string, FolderModel[]>
  onMove(target: MoveTarget): void
}) {
  const targets = buildTargets(collections, foldersByCollection)
  const [selected, setSelected] = useState<number | null>(null)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move request"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={selected === null}
            onClick={() => {
              if (selected !== null) onMove(targets[selected]!)
            }}
          >
            Move
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p className="py-2 text-[12px] text-faint">No collections yet — create one first.</p>
      ) : (
        <div className="max-h-72 space-y-0.5 overflow-y-auto">
          {targets.map((t, i) => (
            <button
              key={`${t.collectionId}_${t.folderId ?? 'root'}`}
              onClick={() => setSelected(i)}
              style={{ paddingLeft: 8 + t.depth * 16 }}
              className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12px] ${
                selected === i ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              <Folder className="h-3.5 w-3.5 shrink-0 text-faint" />
              <span className="truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
