import { useState } from 'react'
import { Bell, CheckCheck, Trash2, X } from 'lucide-react'
import { Button } from '@apiforge/ui'
import { useNotifications, type NotificationTone } from '../stores/notifications'
import { useSession } from '../stores/session'

const TONE_DOT: Record<NotificationTone, string> = {
  info: 'bg-[var(--af-info)]',
  success: 'bg-[var(--af-ok)]',
  error: 'bg-[var(--af-err)]',
  warn: 'bg-[var(--af-warn)]',
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const items = useNotifications((s) => s.items)
  const markAllRead = useNotifications((s) => s.markAllRead)
  const dismiss = useNotifications((s) => s.dismiss)
  const clear = useNotifications((s) => s.clear)
  const setActiveNav = useSession((s) => s.setActiveNav)

  const unread = items.filter((n) => !n.read).length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
        className="relative rounded p-1.5 text-muted transition-colors hover:bg-bg-hover hover:text-text"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-accent px-0.5 text-[8px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute right-0 top-full z-50 mt-1 w-80 overflow-hidden rounded-lg border border-border bg-overlay shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">
                Notifications
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={markAllRead}
                  aria-label="Mark all as read"
                  className="rounded p-1 text-faint transition-colors hover:text-text"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={clear}
                  aria-label="Clear all notifications"
                  className="rounded p-1 text-faint transition-colors hover:text-err"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto py-1">
              {items.length === 0 && (
                <div className="px-3 py-6 text-center text-[12px] text-faint">
                  You're all caught up
                </div>
              )}
              {items.map((n) => (
                <div
                  key={n.id}
                  className={`group flex items-start gap-2.5 border-b border-border px-3 py-2.5 last:border-b-0 ${
                    n.read ? 'opacity-60' : ''
                  }`}
                >
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[n.tone]}`} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] font-medium text-text">{n.title}</div>
                    {n.message && (
                      <div className="mt-0.5 text-[11px] leading-relaxed text-muted">{n.message}</div>
                    )}
                    <div className="mt-0.5 text-[10px] text-faint">{n.time} ago</div>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss notification"
                    className="shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-3 py-2">
              <span className="text-[10px] text-faint">{items.length} total</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActiveNav('settings')
                  setOpen(false)
                }}
              >
                Settings
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}