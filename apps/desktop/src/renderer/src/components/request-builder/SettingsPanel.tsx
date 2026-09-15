import { NumberField, ToggleField } from './fields'
import type { RequestPanelProps } from './types'

export function SettingsPanel({ draft, update }: RequestPanelProps) {
  const settings = draft.settings
  const setSettings = (patch: Partial<typeof settings>) =>
    update((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  return (
    <div className="max-w-sm space-y-4 p-3">
      <NumberField
        label="Timeout (ms)"
        value={settings.timeoutMs}
        onChange={(timeoutMs) => setSettings({ timeoutMs })}
      />
      <ToggleField
        label="Follow redirects"
        checked={settings.followRedirects}
        onChange={(followRedirects) => setSettings({ followRedirects })}
      />
      <NumberField
        label="Max redirects"
        value={settings.maxRedirects}
        onChange={(maxRedirects) => setSettings({ maxRedirects })}
        disabled={!settings.followRedirects}
      />
      <ToggleField
        label="SSL certificate verification"
        checked={settings.sslVerify}
        onChange={(sslVerify) => setSettings({ sslVerify })}
      />
    </div>
  )
}
