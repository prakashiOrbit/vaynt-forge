import { useEffect, useState, type ReactNode } from 'react'
import {
  BadgeCheck,
  Database,
  FileJson,
  Globe,
  Info,
  Keyboard,
  Layers,
  Palette,
  Server,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react'
import { Button, ConfirmDialog, toast } from '@vayntforge/ui'
import type { CertificateEntry, ThemePreference } from '@vayntforge/engine'
import type { UpdateStatus } from '../../../shared/types'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData, useData } from '../stores/data'

type SectionId =
  | 'general'
  | 'appearance'
  | 'editor'
  | 'network'
  | 'proxy'
  | 'certificates'
  | 'environments'
  | 'security'
  | 'shortcuts'
  | 'data'
  | 'import-export'
  | 'about'

const SECTIONS: { id: SectionId; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'editor', label: 'Editor', icon: SlidersHorizontal },
  { id: 'network', label: 'Network', icon: Globe },
  { id: 'proxy', label: 'Proxy', icon: Server },
  { id: 'certificates', label: 'Certificates', icon: ShieldCheck },
  { id: 'environments', label: 'Environments', icon: Layers },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard },
  { id: 'data', label: 'Data', icon: Database },
  { id: 'import-export', label: 'Import / Export', icon: FileJson },
  { id: 'about', label: 'About', icon: Info },
]

function Row({ label, description, children }: { label: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <div className="text-[13px] text-text">{label}</div>
        {description && <div className="mt-0.5 text-[11px] text-faint">{description}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange(v: boolean): void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-bg-active'}`}
    >
      <span className={`block h-4 w-4 translate-x-0.5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

function updateStatusLabel(status: UpdateStatus): string {
  switch (status.state) {
    case 'idle':
      return 'Not checked yet this session.'
    case 'checking':
      return 'Checking GitHub Releases for a newer version…'
    case 'available':
      return `Version ${status.version} is available.`
    case 'not-available':
      return "You're on the latest version."
    case 'downloading':
      return `Downloading version update — ${status.percent}%.`
    case 'downloaded':
      return `Version ${status.version} downloaded — restart to install.`
    case 'error':
      return `Update check failed: ${status.message}`
  }
}

const numberInput = 'h-7 w-24 rounded border border-border bg-bg-input px-2 text-right font-mono text-[12px] text-text'
const textInput = 'h-7 rounded border border-border bg-bg-input px-2 font-mono text-[12px] text-text'

export function SettingsPage() {
  const [section, setSection] = useState<SectionId>('general')
  const theme = useSession((s) => s.theme)
  const setTheme = useSession((s) => s.setTheme)
  const workspaceId = useSession((s) => s.activeWorkspaceId)
  const setActiveNav = useSession((s) => s.setActiveNav)
  const { settings, secretsSupported, history, environments, cookies } = useActiveWorkspaceData()
  const saveSettings = useData((s) => s.saveSettings)
  const clearHistory = useData((s) => s.clearHistory)
  const clearCookies = useData((s) => s.clearCookies)
  const [confirmClearHistory, setConfirmClearHistory] = useState(false)
  const [confirmClearCookies, setConfirmClearCookies] = useState(false)
  const [certName, setCertName] = useState('')
  const [certPem, setCertPem] = useState('')
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ state: 'idle' })

  useEffect(() => {
    void window.vayntforge.update.getStatus().then(setUpdateStatus)
    return window.vayntforge.update.onStatus(setUpdateStatus)
  }, [])

  const patch = (p: Partial<typeof settings>) => void saveSettings(workspaceId, { ...settings, ...p })
  const patchEditor = (p: Partial<typeof settings.editor>) => patch({ editor: { ...settings.editor, ...p } })
  const patchProxy = (p: Partial<typeof settings.proxy>) => patch({ proxy: { ...settings.proxy, ...p } })

  const addCertificate = () => {
    if (!certName.trim() || !certPem.trim()) return
    const entry: CertificateEntry = { id: crypto.randomUUID(), name: certName.trim(), pem: certPem.trim(), addedAt: Date.now() }
    patch({ certificates: [...settings.certificates, entry] })
    setCertName('')
    setCertPem('')
    toast.success('Certificate added', entry.name)
  }

  const removeCertificate = (id: string) => {
    patch({ certificates: settings.certificates.filter((c) => c.id !== id) })
  }

  return (
    <div className="grid h-full grid-cols-[220px_1fr]">
      <div className="border-r border-border py-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] ${
              section === s.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 overflow-y-auto p-6">
        <div className="mx-auto max-w-lg">
          {section === 'general' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">General</h2>
              <Row label="Auto-save requests" description="Save changes to a request as you edit, without pressing Cmd+S.">
                <Toggle checked={settings.autoSave} onChange={(v) => patch({ autoSave: v })} />
              </Row>
            </>
          )}

          {section === 'appearance' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Appearance</h2>
              <Row label="Theme">
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ThemePreference)}
                  className={textInput}
                >
                  <option value="system">System</option>
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </Row>
            </>
          )}

          {section === 'editor' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Editor</h2>
              <Row label="Font size" description="Applies to every code editor (body, scripts, code samples).">
                <input
                  type="number"
                  min={10}
                  max={24}
                  value={settings.editor.fontSize}
                  onChange={(e) => patchEditor({ fontSize: Number(e.target.value) || 13 })}
                  className={numberInput}
                />
              </Row>
              <Row label="Tab size">
                <input
                  type="number"
                  min={1}
                  max={8}
                  value={settings.editor.tabSize}
                  onChange={(e) => patchEditor({ tabSize: Number(e.target.value) || 2 })}
                  className={numberInput}
                />
              </Row>
              <Row label="Word wrap">
                <Toggle checked={settings.editor.wordWrap} onChange={(v) => patchEditor({ wordWrap: v })} />
              </Row>
              <Row label="Autocomplete">
                <Toggle checked={settings.editor.autocomplete} onChange={(v) => patchEditor({ autocomplete: v })} />
              </Row>
              <p className="mt-3 text-[11px] text-faint">
                No minimap setting: editors here run on CodeMirror, which has no minimap widget (unlike Monaco).
              </p>
            </>
          )}

          {section === 'network' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Network</h2>
              <Row label="Default request timeout" description="Applied to new requests — override per-request in Settings.">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={settings.requestTimeoutMs}
                    onChange={(e) => patch({ requestTimeoutMs: Number(e.target.value) || 0 })}
                    className={numberInput}
                  />
                  <span className="text-[11px] text-faint">ms</span>
                </div>
              </Row>
              <Row label="Follow redirects by default">
                <Toggle checked={settings.followRedirects} onChange={(v) => patch({ followRedirects: v })} />
              </Row>
              <Row label="Verify SSL certificates by default">
                <Toggle checked={settings.sslVerify} onChange={(v) => patch({ sslVerify: v })} />
              </Row>
            </>
          )}

          {section === 'proxy' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Proxy</h2>
              <Row label="Use a proxy">
                <Toggle checked={settings.proxy.enabled} onChange={(v) => patchProxy({ enabled: v })} />
              </Row>
              <Row label="Host">
                <input
                  value={settings.proxy.host}
                  onChange={(e) => patchProxy({ host: e.target.value })}
                  placeholder="proxy.internal"
                  className={textInput}
                />
              </Row>
              <Row label="Port">
                <input
                  type="number"
                  value={settings.proxy.port}
                  onChange={(e) => patchProxy({ port: Number(e.target.value) || 0 })}
                  className={numberInput}
                />
              </Row>
            </>
          )}

          {section === 'certificates' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Certificates</h2>
              <p className="mb-3 text-[11px] text-faint">Custom CA certificates trusted for requests in this workspace.</p>
              {settings.certificates.length === 0 ? (
                <p className="py-3 text-center text-[12px] text-faint">No certificates added.</p>
              ) : (
                <div className="mb-4 overflow-hidden rounded-md border border-border">
                  {settings.certificates.map((c) => (
                    <div key={c.id} className="flex items-center justify-between border-b border-border px-3 py-2 last:border-b-0">
                      <span className="text-[12px] text-text">{c.name}</span>
                      <button
                        onClick={() => removeCertificate(c.id)}
                        aria-label={`Remove certificate ${c.name}`}
                        className="text-faint hover:text-err"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-2 rounded-md border border-border p-3">
                <input
                  value={certName}
                  onChange={(e) => setCertName(e.target.value)}
                  placeholder="Certificate name"
                  className={`${textInput} w-full`}
                />
                <textarea
                  value={certPem}
                  onChange={(e) => setCertPem(e.target.value)}
                  placeholder="-----BEGIN CERTIFICATE-----"
                  className="h-24 w-full resize-none rounded border border-border bg-bg-input p-2 font-mono text-[11px] text-text"
                  spellCheck={false}
                />
                <Button size="sm" onClick={addCertificate} disabled={!certName.trim() || !certPem.trim()}>
                  Add certificate
                </Button>
              </div>
            </>
          )}

          {section === 'environments' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Environments</h2>
              <Row label="Environments in this workspace" description={environments.map((e) => e.name).join(', ') || 'None yet'}>
                <span className="font-mono text-[13px] text-text">{environments.length}</span>
              </Row>
              <Button size="sm" variant="outline" onClick={() => setActiveNav('environments')} className="mt-3">
                Manage environments
              </Button>
            </>
          )}

          {section === 'security' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Security</h2>
              <Row label="Confirm before deleting" description="Show a confirmation dialog for destructive actions.">
                <Toggle checked={settings.confirmDeletes} onChange={(v) => patch({ confirmDeletes: v })} />
              </Row>
              <Row label="Secret storage" description="Secret variable values are encrypted with the OS keychain.">
                <span className={`flex items-center gap-1 text-[12px] ${secretsSupported ? 'text-ok' : 'text-warn'}`}>
                  <BadgeCheck className="h-3.5 w-3.5" /> {secretsSupported ? 'Available' : 'Unavailable — stored as plaintext'}
                </span>
              </Row>
            </>
          )}

          {section === 'shortcuts' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Shortcuts</h2>
              <p className="mb-3 text-[12px] text-muted">See every keyboard shortcut on its own screen.</p>
              <Button size="sm" variant="outline" onClick={() => setActiveNav('shortcuts')}>
                <Keyboard className="h-3.5 w-3.5" /> Open Keyboard Shortcuts
              </Button>
            </>
          )}

          {section === 'data' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Data</h2>
              <Row label="Request history" description={`${history.length} recorded request${history.length === 1 ? '' : 's'} in this workspace.`}>
                <Button size="sm" variant="ghost" onClick={() => setConfirmClearHistory(true)} disabled={history.length === 0}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </Row>
              <Row
                label="Cookie jar"
                description={`${cookies.length} stored cookie${cookies.length === 1 ? '' : 's'}, automatically sent with matching requests and captured from real responses — same as a browser or Postman.`}
              >
                <Button size="sm" variant="ghost" onClick={() => setConfirmClearCookies(true)} disabled={cookies.length === 0}>
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              </Row>
              <p className="mt-3 text-[11px] text-faint">All data is stored locally in this device's SQLite database — nothing leaves your machine.</p>
            </>
          )}

          {section === 'import-export' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">Import / Export</h2>
              <p className="mb-3 text-[12px] text-muted">
                Collections import/export (Vaynt Forge, Postman, OpenAPI) live on the Collections screen; environment
                import/export lives on the Environments screen; HAR import lives on the History screen.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setActiveNav('collections')}>
                  Open Collections
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveNav('environments')}>
                  Open Environments
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveNav('history')}>
                  Open History
                </Button>
                <Button size="sm" variant="outline" onClick={() => setActiveNav('openapi')}>
                  Open OpenAPI
                </Button>
              </div>
            </>
          )}

          {section === 'about' && (
            <>
              <h2 className="mb-3 text-[14px] font-semibold text-text">About</h2>
              <Row label="Version">
                <span className="font-mono text-[12px] text-text">{window.vayntforge.app.version}</span>
              </Row>
              <Row label="Updates" description={updateStatusLabel(updateStatus)}>
                {updateStatus.state === 'available' && (
                  <Button size="sm" onClick={() => void window.vayntforge.update.download()}>
                    Download update
                  </Button>
                )}
                {updateStatus.state === 'downloaded' && (
                  <Button size="sm" onClick={() => void window.vayntforge.update.install()}>
                    Restart &amp; install
                  </Button>
                )}
                {(updateStatus.state === 'idle' ||
                  updateStatus.state === 'not-available' ||
                  updateStatus.state === 'error') && (
                  <Button size="sm" variant="outline" onClick={() => void window.vayntforge.update.check()}>
                    Check for updates
                  </Button>
                )}
                {updateStatus.state === 'checking' && (
                  <span className="text-[12px] text-faint">Checking…</span>
                )}
                {updateStatus.state === 'downloading' && (
                  <span className="text-[12px] text-faint">Downloading… {updateStatus.percent}%</span>
                )}
              </Row>
              <p className="mt-3 text-[12px] text-muted">
                Vaynt Forge — a professional desktop API engineering workbench. Everything runs locally; your data stays on this device.
              </p>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmClearHistory}
        title="Clear all history?"
        description={`All ${history.length} recorded request${history.length === 1 ? '' : 's'} will be permanently removed.`}
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={() => {
          setConfirmClearHistory(false)
          void clearHistory(workspaceId)
        }}
        onCancel={() => setConfirmClearHistory(false)}
      />

      <ConfirmDialog
        open={confirmClearCookies}
        title="Clear all cookies?"
        description={`All ${cookies.length} stored cookie${cookies.length === 1 ? '' : 's'} will be permanently removed. You'll need to log in again on any site/API that relied on a session cookie.`}
        confirmLabel="Clear all"
        tone="danger"
        onConfirm={() => {
          setConfirmClearCookies(false)
          void clearCookies(workspaceId)
        }}
        onCancel={() => setConfirmClearCookies(false)}
      />
    </div>
  )
}
