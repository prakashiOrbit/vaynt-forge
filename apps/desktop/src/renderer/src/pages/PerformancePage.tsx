import { Activity } from 'lucide-react'
import { EmptyState } from '@vayntforge/ui'

export function PerformancePage() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-2.5">
        <div className="text-[13px] font-semibold text-text">Performance</div>
        <div className="text-[11px] text-faint">Load and performance testing (Sprint 11)</div>
      </div>
      <div className="min-h-0 flex-1">
        <EmptyState
          icon={Activity}
          title="No performance runs yet"
          description="Simulate concurrent users against your collections and track latency, throughput, and error rates over time."
        />
      </div>
    </div>
  )
}