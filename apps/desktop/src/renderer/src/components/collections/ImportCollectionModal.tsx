import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Modal, Tabs, toast } from '@vayntforge/ui'
import {
  createDraftRequest,
  deserializeCollectionFile,
  generateId,
  parseCurlCommand,
  parsePostmanCollection,
  requestsFromCollectionFile,
} from '@vayntforge/engine'
import { useData } from '../../stores/data'

type ImportFormat = 'native' | 'postman' | 'curl'

const TABS = [
  { id: 'native' as const, label: 'Vaynt Forge (.json)' },
  { id: 'postman' as const, label: 'Postman Collection' },
  { id: 'curl' as const, label: 'cURL command' },
]

export function ImportCollectionModal({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean
  onClose(): void
  workspaceId: string
}) {
  const [format, setFormat] = useState<ImportFormat>('native')
  const [text, setText] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) setText(await file.text())
  }

  const reset = () => {
    setText('')
    onClose()
  }

  const runImport = async () => {
    setImporting(true)
    try {
      if (format === 'curl') {
        const parsed = parseCurlCommand(text)
        const draft = createDraftRequest({
          id: generateId('req'),
          workspaceId,
          method: parsed.method,
          url: parsed.url,
          name: 'Imported from cURL',
        })
        draft.headers = parsed.headers
        draft.body = parsed.body
        if (parsed.basicAuth) draft.auth = { type: 'basic', ...parsed.basicAuth }
        await useData.getState().saveRequest(draft)
        toast.success('Request imported', `${draft.method} ${draft.url}`)
      } else if (format === 'native') {
        const parsed = deserializeCollectionFile(text)
        const created = await useData.getState().createCollection({ workspaceId, name: parsed.name, description: parsed.description })
        const reqs = requestsFromCollectionFile(parsed, workspaceId, created.id)
        for (const r of reqs) await useData.getState().saveRequest(r)
        toast.success('Collection imported', `${created.name} · ${reqs.length} requests`)
      } else {
        const plan = parsePostmanCollection(JSON.parse(text))
        const created = await useData.getState().createCollection({ workspaceId, name: plan.name, description: plan.description })
        let count = 0
        for (const group of plan.groups) {
          const folder = await useData.getState().createFolder({ collectionId: created.id, name: group.tag, requestIds: [] })
          for (const req of group.requests) {
            const draft = createDraftRequest({
              id: generateId('req'),
              workspaceId,
              collectionId: created.id,
              method: req.method,
              name: req.name,
              url: req.url,
            })
            draft.folderId = folder.id
            draft.params = req.params
            draft.headers = req.headers
            draft.auth = req.auth
            draft.body = req.body
            draft.assertions = req.assertions
            draft.variables = req.variables
            await useData.getState().saveRequest(draft)
            count++
          }
        }
        toast.success('Collection imported', `${created.name} · ${count} requests`)
      }
      reset()
    } catch (err) {
      toast.error('Import failed', err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal open={open} onClose={reset} title="Import" width="max-w-xl">
      <div className="flex flex-col gap-3 p-4">
        <Tabs<ImportFormat> active={format} onChange={setFormat} tabs={TABS} />
        <p className="text-[11px] text-faint">
          {format === 'native' && 'A collection previously exported from Vaynt Forge.'}
          {format === 'postman' && 'A Postman Collection v2.x export — nested folders become one group each.'}
          {format === 'curl' && 'Paste a single curl command to import it as one request.'}
        </p>
        {format !== 'curl' && (
          <div>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={(e) => void onFile(e)} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" /> Choose file
            </Button>
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={format === 'curl' ? "curl -X POST 'https://api.example.com/v1/x' -H 'Content-Type: application/json' -d '{}'" : 'Or paste JSON here…'}
          className="h-48 resize-none rounded border border-border bg-bg-input p-2 font-mono text-[12px] text-text outline-none focus:border-accent"
          spellCheck={false}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={reset}>
            Cancel
          </Button>
          <Button onClick={runImport} disabled={!text.trim() || importing}>
            {importing ? 'Importing…' : 'Import'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
