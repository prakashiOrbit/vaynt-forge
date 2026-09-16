import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Download,
  FilePlus,
  FolderPlus,
  Link2,
  PencilLine,
  Play,
  Settings,
  Trash2,
  Upload,
  FolderTree,
  Plus,
} from 'lucide-react'
import { Tree } from 'react-arborist'
import type { MoveHandler, TreeApi } from 'react-arborist'
import { Button, ConfirmDialog, EmptyState, PromptDialog, toast, useContextMenu } from '@vayntforge/ui'
import { createDraftRequest, serializeCollection, exportCollectionPostman, exportCollectionOpenApi } from '@vayntforge/engine'
import type { RequestModel } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'
import { useRequestDrafts } from '../stores/requestDrafts'
import { toCurl } from '../lib/toCurl'
import { runAndRecordRequest } from '../lib/runAndRecord'
import { buildTree, UNFILED_ID, type TreeNode } from '../lib/collectionTree'
import { TreeNodeRow } from '../components/collections/TreeNodeRow'
import { TreeActionsContext } from '../components/collections/treeActions'
import { MoveDialog } from '../components/collections/MoveDialog'
import { CollectionRunner } from '../components/collections/CollectionRunner'
import { ImportCollectionModal } from '../components/collections/ImportCollectionModal'
import { EntitySettingsModal } from '../components/collections/EntitySettingsModal'
import { useKeyboardShortcut } from '../lib/shortcuts'

function downloadText(filename: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

type DeleteTarget =
  | { kind: 'collection'; id: string; name: string }
  | { kind: 'folder'; id: string; collectionId: string; name: string }
  | { kind: 'request'; id: string; name: string }

export function CollectionsPage() {
  const { collections, foldersByCollection, requests, environments, globalVariables } = useActiveWorkspaceData()
  const activeWorkspaceId = useSession((s) => s.activeWorkspaceId)
  const activeEnvironmentId = useSession((s) => s.activeEnvironmentId)
  const openTab = useSession((s) => s.openTab)
  const setActiveNav = useSession((s) => s.setActiveNav)
  const { openContextMenu } = useContextMenu()

  const treeRef = useRef<TreeApi<TreeNode> | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState({ width: 800, height: 500 })

  const [newCollectionOpen, setNewCollectionOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [newFolderTarget, setNewFolderTarget] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState<RequestModel | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [runnerCollectionId, setRunnerCollectionId] = useState<string | null>(null)
  const [settingsTarget, setSettingsTarget] = useState<{ kind: 'collection' | 'folder'; id: string } | null>(null)

  // No per-row selection concept in this tree yet, so Cmd+Shift+R runs the
  // first collection — documented as such on the Keyboard Shortcuts screen.
  useKeyboardShortcut(
    ['cmd', 'shift'],
    'r',
    () => {
      if (collections.length > 0) setRunnerCollectionId(collections[0]!.id)
    },
    { allowInInputs: true }
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const tree = useMemo(
    () => buildTree(collections, foldersByCollection, requests),
    [collections, foldersByCollection, requests]
  )

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  const openRequest = (request: RequestModel) => {
    openTab({ id: request.id, method: request.method, name: request.name, url: request.url })
  }

  const runRequest = async (request: RequestModel) => {
    openRequest(request)
    toast.info('Running…', request.name)
    try {
      const { response } = await runAndRecordRequest({
        request,
        tabId: request.id,
        workspaceId: activeWorkspaceId,
        environmentId: activeEnvironmentId,
        globalVariables,
        environment: activeEnv,
        collections,
        foldersByCollection,
      })
      toast.success(`${response.status} ${response.statusText}`, `${request.name} · ${response.timeMs}ms`)
    } catch (err) {
      toast.error('Run failed', err instanceof Error ? err.message : String(err))
    }
  }

  const newRequestIn = (collectionId: string, folderId?: string) => {
    const id = `req_${crypto.randomUUID().slice(0, 8)}`
    const draft = createDraftRequest({ id, workspaceId: activeWorkspaceId, collectionId })
    if (folderId) draft.folderId = folderId
    useRequestDrafts.getState().reset(id, draft)
    openTab({ id, method: draft.method, name: draft.name, url: draft.url })
  }

  const duplicateRequest = async (request: RequestModel) => {
    const id = `req_${crypto.randomUUID().slice(0, 8)}`
    const clone: RequestModel = {
      ...request,
      id,
      name: `${request.name} (copy)`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await useData.getState().saveRequest(clone)
    openRequest(clone)
    toast.success('Request duplicated', clone.name)
  }

  const duplicateCollection = async (collectionId: string) => {
    const source = collections.find((c) => c.id === collectionId)
    if (!source) return
    const created = await useData.getState().createCollection({
      name: `${source.name} (copy)`,
      workspaceId: activeWorkspaceId,
      description: source.description,
    })
    const folders = foldersByCollection[collectionId] ?? []
    const folderIdMap = new Map<string, string>()
    // Parents before children so `parentFolderId` remaps correctly.
    const ordered = [...folders].sort((a, b) => (a.parentFolderId ? 1 : 0) - (b.parentFolderId ? 1 : 0))
    for (const f of ordered) {
      const newFolder = await useData.getState().createFolder({
        collectionId: created.id,
        name: f.name,
        parentFolderId: f.parentFolderId ? folderIdMap.get(f.parentFolderId) : undefined,
        requestIds: [],
      })
      folderIdMap.set(f.id, newFolder.id)
    }
    const sourceRequests = requests.filter((r) => r.collectionId === collectionId)
    for (const r of sourceRequests) {
      await useData.getState().saveRequest({
        ...r,
        id: `req_${crypto.randomUUID().slice(0, 8)}`,
        collectionId: created.id,
        folderId: r.folderId ? folderIdMap.get(r.folderId) : undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
    toast.success('Collection duplicated', created.name)
  }

  const exportCollectionAs = (collectionId: string, format: 'native' | 'postman' | 'openapi') => {
    const c = collections.find((x) => x.id === collectionId)
    if (!c) return
    const reqs = requests.filter((r) => r.collectionId === collectionId)
    const slug = c.name.replace(/\s+/g, '-').toLowerCase()
    if (format === 'native') {
      downloadText(`${slug}.collection.json`, serializeCollection({ name: c.name, description: c.description, requests: reqs }))
    } else if (format === 'postman') {
      downloadText(`${slug}.postman_collection.json`, JSON.stringify(exportCollectionPostman(c, reqs), null, 2))
    } else {
      downloadText(`${slug}.openapi.json`, JSON.stringify(exportCollectionOpenApi(c, reqs), null, 2))
    }
    toast.success('Collection exported', `${c.name} · ${format === 'native' ? 'Vaynt Forge JSON' : format === 'postman' ? 'Postman v2.1' : 'OpenAPI 3.0'}`)
  }

  const onMove: MoveHandler<TreeNode> = async ({ dragNodes, parentId, parentNode }) => {
    if (!parentId || !parentNode) {
      toast.error('Drop inside a collection', 'Items can’t be moved outside every collection.')
      return
    }
    const parentData = parentNode.data
    let target: { collectionId: string; folderId?: string } | null = null
    if (parentData.kind === 'collection' && parentData.collection) {
      target = { collectionId: parentData.collection.id }
    } else if (parentData.kind === 'folder' && parentData.folder) {
      target = { collectionId: parentData.folder.collectionId, folderId: parentData.folder.id }
    }
    if (!target) {
      toast.error('Can’t drop there', 'Unfiled isn’t a real collection — move into a real one instead.')
      return
    }
    for (const node of dragNodes) {
      const data = node.data
      if (data.kind === 'request' && data.request) {
        await useData.getState().saveRequest({ ...data.request, collectionId: target.collectionId, folderId: target.folderId })
      } else if (data.kind === 'folder' && data.folder) {
        if (data.folder.collectionId !== target.collectionId) {
          toast.error('Can’t move folders between collections', 'Only reordering within the same collection is supported.')
          continue
        }
        await useData.getState().updateFolder(data.folder.id, { parentFolderId: target.folderId })
      }
    }
  }

  const onRename = async ({ id, name }: { id: string; name: string }) => {
    const node = flatFind(tree, id)
    if (!node) return
    if (node.kind === 'collection' && node.collection) {
      await useData.getState().updateCollection(id, { name })
    } else if (node.kind === 'folder' && node.folder) {
      await useData.getState().updateFolder(id, { name })
    } else if (node.kind === 'request' && node.request) {
      await useData.getState().saveRequest({ ...node.request, name })
      useSession.getState().updateTab(id, { name })
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'collection') await useData.getState().deleteCollection(deleteTarget.id)
    else if (deleteTarget.kind === 'folder') await useData.getState().deleteFolder(deleteTarget.id, deleteTarget.collectionId)
    else await useData.getState().deleteRequest(deleteTarget.id)
    toast.success('Deleted', deleteTarget.name)
    setDeleteTarget(null)
  }

  const onContextMenu = (e: React.MouseEvent, node: { data: TreeNode }) => {
    e.preventDefault()
    const data = node.data
    if (data.kind === 'collection') {
      if (data.id === UNFILED_ID) return
      openContextMenu(e, [
        { label: 'New Request', icon: <FilePlus className="h-3.5 w-3.5" />, onSelect: () => newRequestIn(data.id) },
        { label: 'New Folder', icon: <FolderPlus className="h-3.5 w-3.5" />, onSelect: () => setNewFolderTarget(data.id) },
        {
          label: 'Rename',
          icon: <PencilLine className="h-3.5 w-3.5" />,
          onSelect: () => treeRef.current?.get(data.id)?.edit(),
        },
        { label: 'Duplicate', icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void duplicateCollection(data.id) },
        { label: 'Run', icon: <Play className="h-3.5 w-3.5" />, onSelect: () => setRunnerCollectionId(data.id) },
        {
          label: 'Settings',
          icon: <Settings className="h-3.5 w-3.5" />,
          onSelect: () => setSettingsTarget({ kind: 'collection', id: data.id }),
        },
        { label: 'Export → Vaynt Forge JSON', icon: <Download className="h-3.5 w-3.5" />, onSelect: () => exportCollectionAs(data.id, 'native') },
        { label: 'Export → Postman v2.1', icon: <Download className="h-3.5 w-3.5" />, onSelect: () => exportCollectionAs(data.id, 'postman') },
        { label: 'Export → OpenAPI 3.0', icon: <Download className="h-3.5 w-3.5" />, onSelect: () => exportCollectionAs(data.id, 'openapi') },
        { separator: true },
        {
          label: 'Delete',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onSelect: () => setDeleteTarget({ kind: 'collection', id: data.id, name: data.name }),
        },
      ])
    } else if (data.kind === 'folder' && data.folder) {
      openContextMenu(e, [
        {
          label: 'New Request',
          icon: <FilePlus className="h-3.5 w-3.5" />,
          onSelect: () => newRequestIn(data.folder!.collectionId, data.id),
        },
        {
          label: 'Rename',
          icon: <PencilLine className="h-3.5 w-3.5" />,
          onSelect: () => treeRef.current?.get(data.id)?.edit(),
        },
        {
          label: 'Settings',
          icon: <Settings className="h-3.5 w-3.5" />,
          onSelect: () => setSettingsTarget({ kind: 'folder', id: data.id }),
        },
        { separator: true },
        {
          label: 'Delete',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onSelect: () => setDeleteTarget({ kind: 'folder', id: data.id, collectionId: data.folder!.collectionId, name: data.name }),
        },
      ])
    } else if (data.kind === 'request' && data.request) {
      const r = data.request
      openContextMenu(e, [
        { label: 'Open', icon: <FilePlus className="h-3.5 w-3.5" />, onSelect: () => openRequest(r) },
        { label: 'Duplicate', icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void duplicateRequest(r) },
        { label: 'Run', icon: <Play className="h-3.5 w-3.5" />, onSelect: () => void runRequest(r) },
        {
          label: 'Copy as cURL',
          icon: <Copy className="h-3.5 w-3.5" />,
          onSelect: () => {
            void navigator.clipboard.writeText(toCurl(r))
            toast.success('Copied as cURL')
          },
        },
        {
          label: 'Copy URL',
          icon: <Link2 className="h-3.5 w-3.5" />,
          onSelect: () => {
            void navigator.clipboard.writeText(r.url)
            toast.success('URL copied')
          },
        },
        {
          label: 'Rename',
          icon: <PencilLine className="h-3.5 w-3.5" />,
          onSelect: () => treeRef.current?.get(data.id)?.edit(),
        },
        { label: 'Move', icon: <FolderTree className="h-3.5 w-3.5" />, onSelect: () => setMoveTarget(r) },
        { separator: true },
        {
          label: 'Delete',
          icon: <Trash2 className="h-3.5 w-3.5" />,
          danger: true,
          onSelect: () => setDeleteTarget({ kind: 'request', id: data.id, name: data.name }),
        },
      ])
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h1 className="text-[13px] font-semibold text-text">Collections</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setImportOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button size="sm" onClick={() => setNewCollectionOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> New Collection
          </Button>
        </div>
      </div>
      <ImportCollectionModal open={importOpen} onClose={() => setImportOpen(false)} workspaceId={activeWorkspaceId} />
      <EntitySettingsModal
        open={Boolean(settingsTarget)}
        onClose={() => setSettingsTarget(null)}
        kind={settingsTarget?.kind ?? 'collection'}
        collection={settingsTarget?.kind === 'collection' ? collections.find((c) => c.id === settingsTarget.id) : undefined}
        folder={
          settingsTarget?.kind === 'folder'
            ? Object.values(foldersByCollection)
                .flat()
                .find((f) => f.id === settingsTarget.id)
            : undefined
        }
      />

      <div ref={containerRef} className="min-h-0 flex-1">
        {collections.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No collections yet"
            description="Group related requests together, then run them all at once with the Collection Runner."
            action={
              <Button size="sm" onClick={() => setNewCollectionOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Collection
              </Button>
            }
          />
        ) : (
          <TreeActionsContext.Provider value={{ onOpenRequest: openRequest, onContextMenu }}>
            <Tree<TreeNode>
              ref={treeRef}
              data={tree}
              idAccessor="id"
              width={size.width}
              height={size.height}
              rowHeight={26}
              indent={16}
              openByDefault={false}
              disableDrag={(data) => data.kind === 'collection'}
              disableDrop={({ parentNode }) => parentNode.data.id === UNFILED_ID}
              onMove={onMove}
              onRename={(args) => void onRename(args)}
            >
              {TreeNodeRow}
            </Tree>
          </TreeActionsContext.Provider>
        )}
      </div>

      <PromptDialog
        open={newCollectionOpen}
        title="New collection"
        label="Name"
        placeholder="e.g. Payments API"
        confirmLabel="Create"
        onCancel={() => setNewCollectionOpen(false)}
        onConfirm={(name) => {
          void useData.getState().createCollection({ name, workspaceId: activeWorkspaceId })
          setNewCollectionOpen(false)
        }}
      />

      <PromptDialog
        open={newFolderTarget !== null}
        title="New folder"
        label="Name"
        placeholder="e.g. Auth"
        confirmLabel="Create"
        onCancel={() => setNewFolderTarget(null)}
        onConfirm={(name) => {
          if (newFolderTarget) {
            void useData.getState().createFolder({ collectionId: newFolderTarget, name, requestIds: [] })
          }
          setNewFolderTarget(null)
        }}
      />

      <MoveDialog
        open={moveTarget !== null}
        onClose={() => setMoveTarget(null)}
        collections={collections}
        foldersByCollection={foldersByCollection}
        onMove={(target) => {
          if (moveTarget) {
            void useData
              .getState()
              .saveRequest({ ...moveTarget, collectionId: target.collectionId, folderId: target.folderId })
            toast.success('Request moved', moveTarget.name)
          }
          setMoveTarget(null)
        }}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.kind ?? 'item'}?`}
        description={
          deleteTarget?.kind === 'collection'
            ? `"${deleteTarget.name}" and everything in it will be permanently deleted.`
            : deleteTarget?.kind === 'folder'
              ? `"${deleteTarget.name}" and its requests will be permanently deleted.`
              : `"${deleteTarget?.name}" will be permanently deleted.`
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />

      {runnerCollectionId && (
        <CollectionRunner
          collectionId={runnerCollectionId}
          onClose={() => setRunnerCollectionId(null)}
          onOpenRequestBuilder={() => setActiveNav('request-builder')}
        />
      )}
    </div>
  )
}

function flatFind(nodes: TreeNode[], id: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n
    if (n.children) {
      const found = flatFind(n.children, id)
      if (found) return found
    }
  }
  return undefined
}
