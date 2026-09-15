import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, GripVertical } from 'lucide-react'
import type { ReactNode } from 'react'

export interface DataColumn<T> {
  id: string
  header: ReactNode
  align?: 'left' | 'right' | 'center'
  sortable?: boolean
  width?: number
  minWidth?: number
  sortValue?: (row: T) => string | number
  render: (row: T) => ReactNode
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowDoubleClick?: (row: T) => void
  onRowContextMenu?: (e: React.MouseEvent, row: T) => void
  onRowClick?: (row: T) => void
  emptyLabel?: string
}

const MIN_COL = 48
const MAX_COL = 420

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowDoubleClick,
  onRowContextMenu,
  onRowClick,
  emptyLabel = 'No records',
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ id: string; dir: 1 | -1 } | null>(null)
  const [widths, setWidths] = useState<Record<string, number>>({})

  const sorted = (() => {
    const activeSort = sort
    const col = activeSort ? columns.find((c) => c.id === activeSort.id) : undefined
    if (!col?.sortValue) return rows
    const value = col.sortValue
    const dir = activeSort?.dir ?? 1
    return [...rows].sort((a, b) => {
      const av = value(a)
      const bv = value(b)
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv))
      return cmp * dir
    })
  })()

  const toggleSort = (col: DataColumn<T>) => {
    if (!col.sortable) return
    setSort((prev) =>
      prev?.id === col.id ? { id: col.id, dir: prev.dir === 1 ? -1 : 1 } : { id: col.id, dir: 1 }
    )
  }

  const startResize = (colId: string) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault()
    const handle = e.currentTarget
    handle.setPointerCapture(e.pointerId)
    const startX = e.clientX
    const startW = widths[colId] ?? columns.find((c) => c.id === colId)?.width ?? 120
    const onMove = (ev: PointerEvent) => {
      const next = Math.round(
        Math.min(MAX_COL, Math.max(MIN_COL, startW + (ev.clientX - startX)))
      )
      setWidths((w) => ({ ...w, [colId]: next }))
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const alignCls = (align?: 'left' | 'right' | 'center') =>
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'

  return (
    <table className="w-full text-[13px]" style={{ tableLayout: 'fixed' }}>
      <colgroup>
        {columns.map((c) => (
          <col key={c.id} style={{ width: widths[c.id] ?? c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr className="border-b border-border">
          {columns.map((col) => (
            <th
              key={col.id}
              className={`relative select-none border-r border-border p-0 text-[11px] font-semibold uppercase tracking-wider ${alignCls(col.align)} ${
                col.sortable ? 'cursor-pointer' : ''
              }`}
            >
              <div
                onClick={() => toggleSort(col)}
                className={`flex h-8 items-center gap-1 px-2.5 ${
                  col.align === 'right' ? 'flex-row-reverse' : ''
                }`}
              >
                <span className="truncate text-faint">{col.header}</span>
                {col.sortable && (
                  <span className="text-faint">
                    {sort?.id === col.id ? (
                      sort.dir === 1 ? (
                        <ArrowUp className="h-3 w-3 text-accent" />
                      ) : (
                        <ArrowDown className="h-3 w-3 text-accent" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-50" />
                    )}
                  </span>
                )}
              </div>
              <div
                className="absolute inset-y-0 right-0 flex w-2.5 cursor-col-resize items-center justify-center text-faint hover:text-accent"
                onPointerDown={startResize(col.id)}
                aria-hidden
              >
                <GripVertical className="h-3 w-2" />
              </div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="px-4 py-10 text-center text-faint">
              {emptyLabel}
            </td>
          </tr>
        )}
        {sorted.map((row) => (
          <tr
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onDoubleClick={onRowDoubleClick ? () => onRowDoubleClick(row) : undefined}
            onContextMenu={onRowContextMenu ? (e) => onRowContextMenu(e, row) : undefined}
            className="cursor-default border-b border-border transition-colors last:border-b-0 hover:bg-bg-hover"
          >
            {columns.map((col) => (
              <td key={col.id} className={`max-w-0 truncate px-2.5 py-1.5 ${alignCls(col.align)}`}>
                <span className="block truncate">{col.render(row)}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}