import type { HTMLAttributes, ReactNode } from 'react'

export type BadgeTone = 'ok' | 'err' | 'warn' | 'info' | 'neutral'

const TONES: Record<BadgeTone, string> = {
  ok: 'bg-emerald-500/12 text-emerald-400 border-emerald-500/20',
  err: 'bg-red-500/12 text-red-400 border-red-500/20',
  warn: 'bg-amber-500/12 text-amber-400 border-amber-500/20',
  info: 'bg-blue-500/12 text-blue-400 border-blue-500/20',
  neutral: 'bg-white/5 text-[var(--af-text-muted)] border-[var(--af-border)]',
}

interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  children: ReactNode
}

export function StatusBadge({ tone = 'neutral', className = '', children, ...props }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex h-4.5 items-center gap-1 rounded px-1.5 text-[11px] font-medium leading-none border ${TONES[tone]} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}

/** HTTP method chip, color-coded by method. */
export function MethodBadge({ method }: { method: string }) {
  const color = (() => {
    switch (method) {
      case 'GET':
        return 'var(--af-get)'
      case 'POST':
        return 'var(--af-post)'
      case 'PUT':
        return 'var(--af-put)'
      case 'PATCH':
        return 'var(--af-patch)'
      case 'DELETE':
        return 'var(--af-delete)'
      case 'HEAD':
        return 'var(--af-head)'
      default:
        return 'var(--af-options)'
    }
  })()
  return (
    <span className="font-mono text-[11px] font-semibold tracking-wide" style={{ color }}>
      {method}
    </span>
  )
}

export function StatusCode({ code }: { code: number }) {
  const cls =
    code >= 200 && code < 300
      ? 'text-emerald-400'
      : code >= 400 && code < 500
        ? 'text-amber-400'
        : code >= 500
          ? 'text-red-400'
          : 'text-blue-400'
  return <span className={`font-mono text-xs font-medium ${cls}`}>{code}</span>
}