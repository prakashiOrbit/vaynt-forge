import { useMemo, useState } from 'react'
import { Button, CodeEditor, StatusBadge, toast } from '@vayntforge/ui'
import type { CodeEditorLanguage } from '@vayntforge/ui'
import { generateCodeSample, planRequestFromOperation, CODE_SAMPLE_LANGUAGES } from '@vayntforge/engine'
import type { CodeSampleLanguage, OpenApiOperation } from '@vayntforge/engine'

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">{title}</div>
      {children}
    </div>
  )
}

export function ParametersTable({ op }: { op: OpenApiOperation }) {
  if (op.parameters.length === 0) return null
  return (
    <Section title="Parameters">
      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[1fr_auto_auto_1fr] gap-2 border-b border-border bg-raised px-2 py-1.5 text-[10px] font-semibold tracking-wide text-faint uppercase">
          <span>Name</span>
          <span>In</span>
          <span>Required</span>
          <span>Example</span>
        </div>
        {op.parameters.map((p) => (
          <div
            key={`${p.in}-${p.name}`}
            className="grid grid-cols-[1fr_auto_auto_1fr] items-center gap-2 border-b border-border px-2 py-1.5 text-[12px] last:border-b-0"
          >
            <span className="font-mono text-text">{p.name}</span>
            <span className="text-faint">{p.in}</span>
            <span className={p.required ? 'text-err' : 'text-faint'}>{p.required ? 'required' : 'optional'}</span>
            <span className="truncate font-mono text-faint">{p.example ?? '—'}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function RequestBodySection({ op }: { op: OpenApiOperation }) {
  if (!op.requestBody) return null
  return (
    <Section title={`Request Body (${op.requestBody.contentType})`}>
      <CodeEditor value={op.requestBody.example ?? ''} onChange={() => {}} language="json" readOnly minHeight="80px" />
    </Section>
  )
}

export function ResponsesSection({ op }: { op: OpenApiOperation }) {
  return (
    <Section title="Responses">
      <div className="space-y-2">
        {op.responses.map((r) => (
          <div key={r.status} className="rounded-md border border-border">
            <div className="flex items-center gap-2 border-b border-border bg-raised px-2 py-1.5">
              <StatusBadge tone={r.status.startsWith('2') ? 'ok' : r.status.startsWith('4') || r.status.startsWith('5') ? 'err' : 'neutral'}>
                {r.status}
              </StatusBadge>
              {r.description && <span className="text-[11px] text-faint">{r.description}</span>}
            </div>
            {r.content.map((c) => (
              <div key={c.contentType} className="p-2">
                <div className="mb-1 text-[10px] font-medium text-faint">{c.contentType}</div>
                <CodeEditor value={c.example ?? ''} onChange={() => {}} language="json" readOnly minHeight="60px" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Section>
  )
}

const CODE_LANGUAGE: Record<CodeSampleLanguage, CodeEditorLanguage> = {
  curl: 'shell',
  javascript: 'javascript',
  python: 'python',
  java: 'java',
  go: 'go',
}

/** Language-switcher + copyable code sample, self-contained (owns its own selected-language state). */
export function CodeSamplePanel({ op, baseUrl }: { op: OpenApiOperation; baseUrl: string }) {
  const [lang, setLang] = useState<CodeSampleLanguage>('curl')
  const planned = useMemo(() => planRequestFromOperation(op, baseUrl), [op, baseUrl])
  const sample = useMemo(
    () =>
      generateCodeSample(
        {
          method: planned.method,
          url: planned.url,
          headers: planned.headers.filter((h) => h.enabled).map((h) => ({ key: h.key, value: h.value })),
          body: planned.body.type === 'raw' ? planned.body.content : undefined,
        },
        lang
      ),
    [planned, lang]
  )

  const copy = async () => {
    await navigator.clipboard.writeText(sample)
    toast.success('Copied to clipboard')
  }

  return (
    <Section title="Code Samples">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex flex-wrap gap-1">
          {CODE_SAMPLE_LANGUAGES.map((l) => (
            <button
              key={l.id}
              onClick={() => setLang(l.id)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
                lang === l.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => void copy()}>
          Copy
        </Button>
      </div>
      <CodeEditor value={sample} onChange={() => {}} language={CODE_LANGUAGE[lang]} readOnly minHeight="180px" />
    </Section>
  )
}
