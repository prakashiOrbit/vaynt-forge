import { useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Command,
  FileJson,
  FolderPlus,
  Sparkles,
  X,
} from 'lucide-react'
import { useSession } from '../stores/session'
import { useData } from '../stores/data'

type ImportKind = 'openapi' | 'collection' | null

export function Onboarding() {
  const setActiveWorkspace = useSession((s) => s.setActiveWorkspace)
  const completeOnboarding = useSession((s) => s.completeOnboarding)

  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [importNote, setImportNote] = useState<ImportKind>(null)

  const startDemo = () => {
    const demo = useData.getState().workspaces[0]
    if (demo) setActiveWorkspace(demo.id)
    completeOnboarding()
  }

  const submitCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give your workspace a name')
      return
    }
    try {
      const ws = await useData.getState().createWorkspace({ name: trimmed })
      setActiveWorkspace(ws.id)
      completeOnboarding()
    } catch {
      setError('Could not create the workspace. Try again.')
    }
  }

  const cards = [
    {
      key: 'demo',
      icon: Sparkles,
      title: 'Start with Demo Workspace',
      desc: 'Acme API: collections, environments, mocks, and history pre-loaded.',
      tag: 'Recommended',
      onClick: startDemo,
    },
    {
      key: 'create',
      icon: FolderPlus,
      title: 'Create Your Own Workspace',
      desc: 'Start blank and design your API from scratch.',
      onClick: () => {
        setImportNote(null)
        setCreating((c) => !c)
      },
    },
    {
      key: 'openapi',
      icon: FileJson,
      title: 'Import OpenAPI Spec',
      desc: 'Bring a 2.0/3.x spec and turn it into collections.',
      onClick: () => {
        setCreating(false)
        setImportNote('openapi')
      },
    },
    {
      key: 'collection',
      icon: BookOpen,
      title: 'Import Postman Collection',
      desc: 'Migrate collections from Postman or other tools.',
      onClick: () => {
        setCreating(false)
        setImportNote('collection')
      },
    },
  ]

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center overflow-auto bg-bg text-text">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(600px 300px at 50% -10%, var(--accent) 0%, transparent 60%), radial-gradient(500px 280px at 85% 110%, var(--accent-2) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 my-auto flex w-full max-w-2xl flex-col items-center px-6 py-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-2">
            <Command className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-[0.24em] text-text font-display">APIFORGE</span>
        </div>
        <h1 className="mt-6 text-center text-2xl font-semibold text-text">
          Build, test, debug, and understand your APIs.
        </h1>
        <p className="mt-2 max-w-md text-center text-[13px] text-muted">
          A native API engineering workbench for collections, mocks, tests, live protocols, and
          documentation — all in one place.
        </p>

        <div className="mt-8 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {cards.map((card) => (
            <button
              key={card.key}
              onClick={card.onClick}
              className={`group relative flex flex-col items-start gap-2 rounded-lg border border-border bg-raised p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                card.key === 'demo' ? 'sm:col-span-2' : ''
              }`}
            >
              <div className="flex w-full items-center justify-between">
                <card.icon className="h-4.5 w-4.5 text-accent" />
                {card.tag && (
                  <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[10px] font-medium text-accent">
                    {card.tag}
                  </span>
                )}
              </div>
              <span className="text-[13px] font-semibold text-text">{card.title}</span>
              <span className="text-[12px] leading-relaxed text-muted">{card.desc}</span>
              <span className="mt-1 flex items-center gap-1 text-[12px] text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Get started <ArrowRight className="h-3 w-3" />
              </span>
            </button>
          ))}
        </div>

        {creating && (
          <div className="mt-4 w-full rounded-lg border border-accent/40 bg-raised p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold text-text">Name your workspace</span>
              <button
                onClick={() => {
                  setCreating(false)
                  setError(null)
                }}
                aria-label="Cancel"
                className="rounded p-0.5 text-faint hover:text-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                autoFocus
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitCreate()
                  if (e.key === 'Escape') setCreating(false)
                }}
                placeholder="e.g. Payments API"
                className="h-8 flex-1 rounded-md border border-border bg-bg-input px-3 text-[13px] text-text outline-none placeholder:text-faint focus:border-accent"
              />
              <button
                onClick={submitCreate}
                className="h-8 rounded-md bg-accent px-3 text-[12px] font-medium text-white transition-colors hover:bg-accent-2"
              >
                Create
              </button>
            </div>
            {error && <p className="mt-1.5 text-[11px] text-err">{error}</p>}
          </div>
        )}

        {importNote && (
          <div className="mt-4 w-full rounded-lg border border-border bg-raised p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[12px] font-semibold text-text">
                  {importNote === 'openapi' ? 'OpenAPI import' : 'Collection import'} arrives in a
                  later sprint
                </span>
                <p className="mt-1 text-[12px] text-muted">
                  The import pipeline is on the roadmap. For now, start in the demo workspace — it
                  ships with collections, environments, mocks, and history you can explore.
                </p>
              </div>
              <button
                onClick={() => setImportNote(null)}
                aria-label="Close"
                className="rounded p-0.5 text-faint hover:text-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <button
              onClick={startDemo}
              className="mt-3 rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-accent-2"
            >
              Start with demo workspace
            </button>
          </div>
        )}

        <p className="mt-8 text-[11px] text-faint">
          Everything runs locally · Your data stays on this device
        </p>
      </div>
    </div>
  )
}