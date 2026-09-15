import { useEffect, useMemo, useRef, useState } from 'react'
import { CornerDownLeft, FolderOpen, History, Layers, Plus, Search, Send } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HttpMethod } from '@vayntforge/engine'
import { NAV_ITEMS } from '../navigation'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData } from '../stores/data'
import { useKeyboardShortcut } from '../lib/shortcuts'

interface PaletteItem {
  id: string
  group: string
  label: string
  hint?: string
  keywords?: string
  icon: LucideIcon
  run: () => void
}

export function CommandPalette() {
  const open = useSession((s) => s.paletteOpen)
  const setPaletteOpen = useSession((s) => s.setPaletteOpen)
  const setActiveNav = useSession((s) => s.setActiveNav)
  const setActiveEnvironment = useSession((s) => s.setActiveEnvironment)
  const openNewRequest = useSession((s) => s.openNewRequest)
  const openTab = useSession((s) => s.openTab)

  const { requests, collections, history, environments } = useActiveWorkspaceData()

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const items = useMemo<PaletteItem[]>(() => {
    const list: PaletteItem[] = NAV_ITEMS.map((nav) => ({
      id: `nav:${nav.id}`,
      group: 'Navigate',
      label: nav.label,
      hint: 'Open screen',
      keywords: nav.id,
      icon: nav.icon,
      run: () => setActiveNav(nav.id),
    }))
    list.push({
      id: 'new-request',
      group: 'Actions',
      label: 'New Request',
      hint: 'Open a fresh request tab',
      keywords: 'request create',
      icon: Plus,
      run: () => openNewRequest(),
    })

    const countFor = new Map<string, number>()
    for (const r of requests) {
      if (r.collectionId) countFor.set(r.collectionId, (countFor.get(r.collectionId) ?? 0) + 1)
    }

    for (const r of requests.slice(0, 12)) {
      list.push({
        id: `req:${r.id}`,
        group: 'Requests',
        label: r.name,
        hint: `${r.method} ${r.url}`,
        keywords: r.method,
        icon: Send,
        run: () => openTab({ id: r.id, method: r.method, name: r.name, url: r.url }),
      })
    }

    for (const c of collections) {
      list.push({
        id: `col:${c.id}`,
        group: 'Collections',
        label: c.name,
        hint: `${countFor.get(c.id) ?? 0} requests`,
        keywords: 'collection',
        icon: FolderOpen,
        run: () => setActiveNav('collections'),
      })
    }

    for (const h of history.slice(0, 8)) {
      list.push({
        id: `hist:${h.id}`,
        group: 'History',
        label: `${h.method} ${h.url}`,
        hint: `${h.requestName} · ${h.status}`,
        keywords: h.requestName,
        icon: History,
        run: () =>
          openTab({
            id: h.id,
            method: h.method as HttpMethod,
            name: h.requestName || h.method,
            url: h.url,
          }),
      })
    }

    for (const env of environments) {
      list.push({
        id: `env:${env.id}`,
        group: 'Switch Environment',
        label: env.name,
        hint: env.isProduction ? 'Production' : 'Active environment',
        keywords: env.id,
        icon: Layers,
        run: () => setActiveEnvironment(env.id),
      })
    }
    return list
  }, [
    setActiveNav,
    setActiveEnvironment,
    openNewRequest,
    openTab,
    requests,
    collections,
    history,
    environments,
  ])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = items.filter(
      (item) =>
        !q ||
        item.label.toLowerCase().includes(q) ||
        (item.keywords ?? '').toLowerCase().includes(q) ||
        item.group.toLowerCase().includes(q)
    )
    const byGroup = new Map<string, PaletteItem[]>()
    for (const item of filtered) {
      const arr = byGroup.get(item.group)
      if (arr) arr.push(item)
      else byGroup.set(item.group, [item])
    }
    return [...byGroup.entries()].map(([group, entries]) => ({ group, entries }))
  }, [items, query])

  const flat = useMemo(() => groups.flatMap((g) => g.entries), [groups])

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      setPaletteOpen(true)
    }
  }, [open, setPaletteOpen])

  useEffect(() => {
    setIndex(0)
  }, [query])

  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 0)
      return () => window.clearTimeout(id)
    }
  }, [open])

  useKeyboardShortcut([], 'escape', () => setPaletteOpen(false), { allowInInputs: true })

  if (!open) return null

  const commit = (item: PaletteItem) => {
    item.run()
    setPaletteOpen(false)
  }

  const move = (delta: number) => {
    if (flat.length === 0) return
    setIndex((i) => (i + delta + flat.length) % flat.length)
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={() => setPaletteOpen(false)} />
      <div className="absolute inset-x-0 top-[18%] mx-auto w-full max-w-lg px-4">
        <div className="overflow-hidden rounded-xl border border-border bg-overlay shadow-2xl">
          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-faint" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  move(1)
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  move(-1)
                } else if (e.key === 'Enter') {
                  const item = flat[index]
                  if (item) commit(item)
                } else if (e.key === 'Escape') {
                  setPaletteOpen(false)
                }
              }}
              placeholder="Type a command or search..."
              className="h-12 flex-1 bg-transparent text-[14px] text-text outline-none placeholder:text-faint focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            />
            <kbd className="rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] text-faint">
              ESC
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto py-1.5">
            {flat.length === 0 && (
              <div className="px-4 py-6 text-center text-[12px] text-faint">
                No matching commands for “{query}”
              </div>
            )}
            {groups.map((group) => (
              <div key={group.group}>
                <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-faint">
                  {group.group}
                </div>
                {group.entries.map((item) => {
                  const flatIndex = flat.indexOf(item)
                  const selected = flatIndex === index
                  return (
                    <button
                      key={item.id}
                      onClick={() => commit(item)}
                      onMouseMove={() => setIndex(flatIndex)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                        selected ? 'bg-bg-active' : ''
                      }`}
                    >
                      <item.icon
                        className={`h-4 w-4 shrink-0 ${selected ? 'text-accent' : 'text-faint'}`}
                      />
                      <span className="flex-1 truncate text-[13px] text-text">{item.label}</span>
                      {item.hint && (
                        <span className="truncate text-[11px] text-faint">{item.hint}</span>
                      )}
                      {selected && <CornerDownLeft className="h-3 w-3 text-faint" />}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-border bg-raised px-4 py-1.5 text-[10px] text-faint">
            <span className="flex items-center gap-1">
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd>↵</kbd> select
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}