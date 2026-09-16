import { useEffect, useState } from 'react'
import { Eye, EyeOff, Plus, Trash2 } from 'lucide-react'
import { Button, CodeEditor, Modal, Tabs, toast, type TabItem } from '@vayntforge/ui'
import type { AuthConfig, Collection, Folder, RequestScripts, Variable } from '@vayntforge/engine'
import { useData } from '../../stores/data'
import { AuthorizationPanel } from '../request-builder/AuthorizationPanel'

type SettingsTab = 'auth' | 'scripts' | 'variables'

const EMPTY_SCRIPTS: RequestScripts = { preRequest: '', postResponse: '' }

function newVariable(): Variable {
  return { id: crypto.randomUUID(), key: '', initialValue: '', currentValue: '', scope: 'collection', secret: false }
}

/**
 * Edits a Collection's or a Folder's own auth/scripts (and, for a
 * Collection only, its variables) — what every request inside it can
 * inherit or resolve against. A Folder's auth can itself be "Inherit from
 * Parent" (its own parent folder, or the collection); a Collection is the
 * inheritance root, so it never gets that option.
 */
export function EntitySettingsModal({
  open,
  onClose,
  kind,
  collection,
  folder,
}: {
  open: boolean
  onClose(): void
  kind: 'collection' | 'folder'
  collection?: Collection
  folder?: Folder
}) {
  const entity = kind === 'collection' ? collection : folder
  const [tab, setTab] = useState<SettingsTab>('auth')
  const [auth, setAuth] = useState<AuthConfig>({ type: 'none' })
  const [scripts, setScripts] = useState<RequestScripts>(EMPTY_SCRIPTS)
  const [variables, setVariables] = useState<Variable[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setAuth(entity?.auth ?? { type: 'none' })
    setScripts(entity?.scripts ?? EMPTY_SCRIPTS)
    setVariables(collection?.variables ?? [])
    setTab('auth')
  }, [open, entity, collection])

  if (!entity) return null

  const tabs: TabItem<SettingsTab>[] =
    kind === 'collection'
      ? [
          { id: 'auth', label: 'Authorization' },
          { id: 'scripts', label: 'Scripts' },
          { id: 'variables', label: 'Variables', badge: variables.length },
        ]
      : [
          { id: 'auth', label: 'Authorization' },
          { id: 'scripts', label: 'Scripts' },
        ]

  const save = async () => {
    setSaving(true)
    try {
      if (kind === 'collection' && collection) {
        await useData.getState().updateCollection(collection.id, { auth, scripts, variables })
      } else if (kind === 'folder' && folder) {
        await useData.getState().updateFolder(folder.id, { auth, scripts })
      }
      toast.success('Settings saved', entity.name)
      onClose()
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`${entity.name} Settings`} width="max-w-xl">
      <div className="flex flex-col gap-3 p-4">
        <Tabs<SettingsTab> active={tab} onChange={setTab} tabs={tabs} />

        {tab === 'auth' && <AuthorizationPanel auth={auth} setAuth={setAuth} showInherit={kind === 'folder'} />}

        {tab === 'scripts' && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-faint">Pre-request Script</label>
              <CodeEditor
                value={scripts.preRequest}
                onChange={(preRequest) => setScripts((s) => ({ ...s, preRequest }))}
                language="javascript"
                minHeight="120px"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-faint">Post-response Script</label>
              <CodeEditor
                value={scripts.postResponse}
                onChange={(postResponse) => setScripts((s) => ({ ...s, postResponse }))}
                language="javascript"
                minHeight="120px"
              />
            </div>
            <p className="text-[11px] text-faint">
              Runs before/after every request in this {kind}
              {kind === 'collection' ? ', ahead of any folder and the' : ', ahead of the'} request's own scripts.
            </p>
          </div>
        )}

        {tab === 'variables' && kind === 'collection' && (
          <div className="space-y-2">
            {variables.length === 0 && <p className="py-3 text-center text-[12px] text-faint">No variables yet.</p>}
            {variables.map((v) => (
              <div key={v.id} className="flex items-center gap-2">
                <input
                  value={v.key}
                  onChange={(e) => setVariables((list) => list.map((x) => (x.id === v.id ? { ...x, key: e.target.value } : x)))}
                  placeholder="key"
                  className="h-7 flex-1 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
                />
                <input
                  value={v.currentValue}
                  onChange={(e) =>
                    setVariables((list) =>
                      list.map((x) => (x.id === v.id ? { ...x, currentValue: e.target.value, initialValue: e.target.value } : x))
                    )
                  }
                  placeholder="value"
                  type={v.secret ? 'password' : 'text'}
                  className="h-7 flex-1 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text"
                />
                <button
                  onClick={() => setVariables((list) => list.map((x) => (x.id === v.id ? { ...x, secret: !x.secret } : x)))}
                  className={`rounded p-1 ${v.secret ? 'text-accent' : 'text-faint hover:text-text'}`}
                  title={v.secret ? 'Marked secret' : 'Mark as secret'}
                >
                  {v.secret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => setVariables((list) => list.filter((x) => x.id !== v.id))}
                  className="rounded p-1 text-faint hover:text-err"
                  aria-label={`Remove variable ${v.key || '(unnamed)'}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setVariables((list) => [...list, newVariable()])}>
              <Plus className="h-3.5 w-3.5" /> Add variable
            </Button>
            <p className="text-[11px] text-faint">
              Resolved for every request in this collection, between global and environment variables in priority.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
