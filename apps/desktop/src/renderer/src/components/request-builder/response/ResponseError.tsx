import { AlertTriangle, Bug, Copy, RefreshCw } from 'lucide-react'
import { Button, toast } from '@vayntforge/ui'
import { diagnoseFailure } from '@vayntforge/engine'
import type { ResponseModel } from '@vayntforge/engine'

export function ResponseError({
  response,
  url,
  onRetry,
  onOpenRequest,
  onOpenDebugger,
}: {
  response: ResponseModel
  url: string
  onRetry(): void
  onOpenRequest(): void
  onOpenDebugger(): void
}) {
  const { isNetworkError, title, causes } = diagnoseFailure(response, url)

  const copyError = () => {
    const summary = [
      title,
      `URL: ${url}`,
      `Duration: ${response.timeMs}ms`,
      isNetworkError ? `Cause: ${response.error!.message}` : `Body: ${response.bodyText}`,
    ].join('\n')
    void navigator.clipboard.writeText(summary)
    toast.success('Error details copied')
  }

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-auto px-6 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-err/30 bg-err/10">
        <AlertTriangle className="h-5 w-5 text-err" />
      </div>
      <h3 className="mt-4 text-[14px] font-semibold text-text">{title}</h3>
      <p className="mt-1 font-mono text-[11px] break-all text-faint">{url}</p>
      <p className="mt-1 text-[12px] text-faint">{response.timeMs}ms elapsed</p>

      {isNetworkError && <p className="mt-3 max-w-md text-[12px] text-muted">{response.error!.message}</p>}

      <div className="mt-5 w-full max-w-sm text-left">
        <h4 className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">Possible causes</h4>
        <ul className="space-y-1 text-[12px] text-muted">
          {causes.map((c) => (
            <li key={c} className="flex gap-1.5">
              <span className="text-faint">•</span>
              {c}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 flex gap-2">
        <Button size="sm" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenRequest}>
          Open Request
        </Button>
        <Button size="sm" variant="outline" onClick={onOpenDebugger}>
          <Bug className="h-3.5 w-3.5" /> Open in Debugger
        </Button>
        <Button size="sm" variant="ghost" onClick={copyError}>
          <Copy className="h-3.5 w-3.5" /> Copy Error
        </Button>
      </div>
    </div>
  )
}
