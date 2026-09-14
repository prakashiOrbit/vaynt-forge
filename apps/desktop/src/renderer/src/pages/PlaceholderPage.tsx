import { Construction } from 'lucide-react'
import { navLabel } from '../navigation'

export function PlaceholderPage({ navId }: { navId: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-raised">
        <Construction className="h-5 w-5 text-faint" />
      </div>
      <h1 className="text-sm font-semibold text-text">{navLabel(navId)}</h1>
      <p className="max-w-sm text-center text-[12px] text-faint">
        This workspace is scaffolded and wired into navigation. Its full screen ships in an
        upcoming sprint (see DEVELOPMENT_ROADMAP.md).
      </p>
    </div>
  )
}