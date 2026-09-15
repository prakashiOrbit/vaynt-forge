import { BookOpen } from 'lucide-react'
import { EmptyState } from '@vayntforge/ui'

export function DocumentationPage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <div className="text-[13px] font-semibold text-text">Documentation</div>
        <div className="text-[11px] text-faint">Automated API docs (Sprint 13)</div>
      </div>
      <div className="min-h-0 flex-1">
        <EmptyState
          icon={BookOpen}
          title="No documentation generated"
          description="Vaynt Forge generates clean, hosted-style docs from your OpenAPI specs and collections. Import a spec to get started."
        />
      </div>
    </div>
  )
}