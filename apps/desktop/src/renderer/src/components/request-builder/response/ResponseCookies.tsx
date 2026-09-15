import type { ResponseCookie } from '@vayntforge/engine'

export function ResponseCookies({ cookies }: { cookies: ResponseCookie[] }) {
  if (cookies.length === 0) {
    return <p className="p-4 text-center text-[12px] text-faint">No cookies were set.</p>
  }
  return (
    <div className="overflow-auto p-2">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-left text-[10px] tracking-wide text-faint uppercase">
            <th className="px-2 py-1 font-medium">Name</th>
            <th className="px-2 py-1 font-medium">Value</th>
            <th className="px-2 py-1 font-medium">Domain</th>
            <th className="px-2 py-1 font-medium">Path</th>
            <th className="px-2 py-1 font-medium">Flags</th>
          </tr>
        </thead>
        <tbody>
          {cookies.map((c, i) => (
            <tr key={`${c.name}_${i}`} className="border-t border-border">
              <td className="px-2 py-1.5 font-mono text-accent">{c.name}</td>
              <td className="max-w-0 truncate px-2 py-1.5 font-mono text-muted">{c.value}</td>
              <td className="px-2 py-1.5 text-faint">{c.domain ?? '—'}</td>
              <td className="px-2 py-1.5 text-faint">{c.path ?? '—'}</td>
              <td className="px-2 py-1.5 text-faint">
                {[c.httpOnly && 'HttpOnly', c.secure && 'Secure'].filter(Boolean).join(', ') || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
