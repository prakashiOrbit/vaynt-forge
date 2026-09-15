import { AlertTriangle, Copy, RefreshCw } from 'lucide-react'
import { Button, toast } from '@vayntforge/ui'
import type { ResponseModel } from '@vayntforge/engine'

const CAUSES_BY_STATUS: Record<number, string[]> = {
  500: ['An unhandled exception on the server', 'A downstream dependency (database, cache) timed out', 'Bad deploy or config change'],
  502: ['The upstream service is down or unreachable', 'A reverse proxy misconfiguration'],
  503: ['The service is overloaded or in maintenance', 'Rate limiting kicked in'],
  504: ['The upstream service took too long to respond'],
}

const NETWORK_CAUSES = [
  'The URL is unreachable or the host does not exist',
  'A firewall, VPN, or proxy is blocking the connection',
  'The server is not accepting connections on that port',
]

export function ResponseError({
  response,
  url,
  onRetry,
  onOpenRequest,
}: {
  response: ResponseModel
  url: string
  onRetry(): void
  onOpenRequest(): void
}) {
  const isNetworkError = Boolean(response.error)
  const title = isNetworkError
    ? `Request failed — ${response.error!.code}`
    : `Request failed — ${response.status} ${response.statusText}`
  const causes = isNetworkError ? NETWORK_CAUSES : (CAUSES_BY_STATUS[response.status] ?? ['An unexpected server-side error'])

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
        <Button size="sm" variant="ghost" onClick={copyError}>
          <Copy className="h-3.5 w-3.5" /> Copy Error
        </Button>
      </div>
    </div>
  )
}
