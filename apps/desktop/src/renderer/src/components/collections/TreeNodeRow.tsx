import { ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react'
import { MethodBadge } from '@vayntforge/ui'
import type { NodeRendererProps } from 'react-arborist'
import type { TreeNode } from '../../lib/collectionTree'
import { useTreeActions } from './treeActions'

export function TreeNodeRow({ node, style, dragHandle }: NodeRendererProps<TreeNode>) {
  const data = node.data
  const { onOpenRequest, onContextMenu } = useTreeActions()

  return (
    <div
      ref={dragHandle}
      style={style}
      onClick={() => {
        if (data.kind === 'request' && data.request) onOpenRequest(data.request)
        else node.toggle()
      }}
      onContextMenu={(e) => onContextMenu(e, node)}
      className={`flex cursor-default items-center gap-1.5 px-1.5 text-[12px] transition-colors ${
        node.isSelected ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
      } ${node.willReceiveDrop ? 'outline outline-1 outline-accent -outline-offset-1' : ''}`}
    >
      {!node.isLeaf ? (
        <button
          onClick={(e) => {
            e.stopPropagation()
            node.toggle()
          }}
          className="shrink-0 text-faint"
          aria-label={node.isOpen ? 'Collapse' : 'Expand'}
        >
          {node.isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
      ) : (
        <span className="w-3.5 shrink-0" />
      )}

      {data.kind === 'collection' &&
        (node.isOpen ? (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-faint" />
        ) : (
          <Folder className="h-3.5 w-3.5 shrink-0 text-faint" />
        ))}
      {data.kind === 'folder' && <Folder className="h-3.5 w-3.5 shrink-0 text-faint" />}
      {data.kind === 'request' && data.method && <MethodBadge method={data.method} />}

      {node.isEditing ? (
        <input
          autoFocus
          defaultValue={data.name}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.stopPropagation()}
          onBlur={(e) => node.submit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') node.submit(e.currentTarget.value)
            if (e.key === 'Escape') node.reset()
          }}
          className="h-5.5 min-w-0 flex-1 rounded border border-accent bg-bg-input px-1 text-[12px] text-text outline-none"
        />
      ) : (
        <span
          className={`truncate ${data.kind !== 'request' ? 'font-medium' : ''} ${
            node.isSelected ? 'text-text' : ''
          }`}
        >
          {data.name}
        </span>
      )}

      {data.kind === 'collection' && data.collection?.chainRules?.some((r) => r.enabled) && (
        <span className="shrink-0 rounded bg-accent-2/15 px-1 text-[9px] font-medium text-accent-2">chain</span>
      )}
    </div>
  )
}
