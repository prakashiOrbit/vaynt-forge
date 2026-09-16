import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BookOpen, FileJson, KeyRound } from 'lucide-react'
import { EmptyState, MethodBadge, StatusBadge } from '@vayntforge/ui'
import { parseOpenApiSpec, parseOpenApiText } from '@vayntforge/engine'
import type { OpenApiOperation, OpenApiResponse } from '@vayntforge/engine'
import { useSession } from '../stores/session'
import { useActiveWorkspaceData } from '../stores/data'
import { useOpenApiUi } from '../stores/openApiUi'
import { ParametersTable, RequestBodySection, ResponsesSection, CodeSamplePanel } from '../components/openapi/EndpointSections'

const OVERVIEW_SECTION = '__overview__'
const ERRORS_SECTION = '__errors__'

export function DocumentationPage() {
  const { openApiSpecs } = useActiveWorkspaceData()
  const setActiveNav = useSession((s) => s.setActiveNav)
  const selectedSpecId = useOpenApiUi((s) => s.selectedSpecId)
  const docsTag = useOpenApiUi((s) => s.docsTag)
  const setSelectedSpec = useOpenApiUi((s) => s.setSelectedSpec)

  const [section, setSection] = useState<string>(docsTag ?? OVERVIEW_SECTION)

  const selectedSpec = openApiSpecs.find((s) => s.id === selectedSpecId) ?? openApiSpecs[0]

  const spec = useMemo(() => {
    if (!selectedSpec) return null
    try {
      return parseOpenApiSpec(parseOpenApiText(selectedSpec.raw))
    } catch {
      return null
    }
  }, [selectedSpec])

  useEffect(() => {
    if (docsTag) setSection(docsTag)
  }, [docsTag, selectedSpecId])

  if (openApiSpecs.length === 0) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-2.5">
          <div className="text-[13px] font-semibold text-text">Documentation</div>
          <div className="text-[11px] text-faint">Generated from an imported OpenAPI spec</div>
        </div>
        <EmptyState
          icon={BookOpen}
          title="No documentation generated"
          description="Vaynt Forge generates clean, hosted-style docs from your OpenAPI specs. Import a spec on the OpenAPI screen to get started."
          action={
            <button onClick={() => setActiveNav('openapi')} className="text-[12px] font-medium text-accent hover:underline">
              Go to OpenAPI →
            </button>
          }
        />
      </div>
    )
  }

  if (!spec) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border px-4 py-2.5">
          <div className="text-[13px] font-semibold text-text">Documentation</div>
        </div>
        <EmptyState icon={FileJson} title="This spec couldn’t be parsed" description="Fix or re-import it from the OpenAPI screen." />
      </div>
    )
  }

  const errorResponses = new Map<string, OpenApiResponse>()
  for (const op of spec.operations) {
    for (const r of op.responses) {
      if (!/^2\d\d$/.test(r.status) && !errorResponses.has(r.status)) errorResponses.set(r.status, r)
    }
  }

  const navSections = [
    { id: OVERVIEW_SECTION, label: 'Overview' },
    ...spec.tags.map((t) => ({ id: t.name, label: t.name })),
    ...(errorResponses.size > 0 ? [{ id: ERRORS_SECTION, label: 'Errors' }] : []),
  ]

  return (
    <div className="flex h-full">
      <div className="flex w-56 shrink-0 flex-col border-r border-border">
        <div className="border-b border-border px-2.5 py-2">
          {openApiSpecs.length > 1 ? (
            <select
              value={selectedSpec?.id}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className="h-7 w-full rounded border border-border bg-bg-input px-1.5 text-[12px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {openApiSpecs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[12px] font-medium text-text">{selectedSpec?.name}</span>
          )}
        </div>
        <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {navSections.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                section === n.id ? 'bg-bg-active text-text' : 'text-muted hover:bg-bg-hover hover:text-text'
              }`}
            >
              {n.id === ERRORS_SECTION && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-faint" />}
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === OVERVIEW_SECTION ? (
          <OverviewSection spec={spec} />
        ) : section === ERRORS_SECTION ? (
          <ErrorsSection responses={[...errorResponses.values()]} />
        ) : (
          <TagSection tag={section} operations={spec.operations.filter((op) => (op.tags[0] ?? 'General') === section)} baseUrl={spec.servers[0]?.url ?? ''} />
        )}
      </div>
    </div>
  )
}

function OverviewSection({ spec }: { spec: ReturnType<typeof parseOpenApiSpec> }) {
  return (
    <div className="max-w-2xl space-y-5 p-6">
      <div>
        <h1 className="text-[18px] font-semibold text-text">{spec.info.title}</h1>
        <div className="mt-0.5 flex items-center gap-2 text-[12px] text-faint">
          <span>Version {spec.info.version}</span>
          {spec.sourceDialect === 'swagger2' && (
            <StatusBadge tone="neutral" title="This spec was written in Swagger 2.0 and normalized into OpenAPI 3.0 on import">
              Swagger 2.0 → converted
            </StatusBadge>
          )}
        </div>
      </div>
      {spec.info.description && <p className="text-[13px] leading-relaxed text-muted">{spec.info.description}</p>}

      <div>
        <h2 className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">Servers</h2>
        <div className="space-y-1">
          {spec.servers.map((s) => (
            <div key={s.url} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
              <span className="font-mono text-[12px] text-text">{s.url}</span>
              {s.description && <span className="text-[11px] text-faint">{s.description}</span>}
            </div>
          ))}
          {spec.servers.length === 0 && <p className="text-[12px] text-faint">No servers declared.</p>}
        </div>
      </div>

      {spec.securitySchemes.length > 0 && (
        <div>
          <h2 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
            <KeyRound className="h-3 w-3" /> Authentication
          </h2>
          <div className="space-y-1.5">
            {spec.securitySchemes.map((sec) => (
              <div key={sec.name} className="rounded-md border border-border px-2.5 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-medium text-text">{sec.name}</span>
                  <StatusBadge tone="info">
                    {sec.type}
                    {sec.scheme ? ` · ${sec.scheme}` : ''}
                  </StatusBadge>
                </div>
                {sec.description && <p className="mt-0.5 text-[11px] text-faint">{sec.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="mb-1.5 text-[11px] font-semibold tracking-wide text-faint uppercase">Sections</h2>
        <p className="text-[12px] text-faint">{spec.operations.length} endpoints across {spec.tags.length} tags. Pick a section from the left to read its endpoint docs.</p>
      </div>
    </div>
  )
}

function ErrorsSection({ responses }: { responses: OpenApiResponse[] }) {
  return (
    <div className="max-w-2xl space-y-4 p-6">
      <h1 className="text-[16px] font-semibold text-text">Errors</h1>
      <p className="text-[12px] text-muted">Non-2xx responses documented across this API's endpoints.</p>
      <div className="space-y-2">
        {responses
          .sort((a, b) => a.status.localeCompare(b.status))
          .map((r) => (
            <div key={r.status} className="rounded-md border border-border">
              <div className="flex items-center gap-2 border-b border-border bg-raised px-2.5 py-1.5">
                <StatusBadge tone={r.status.startsWith('4') ? 'warn' : 'err'}>{r.status}</StatusBadge>
                {r.description && <span className="text-[12px] text-muted">{r.description}</span>}
              </div>
              {r.content.map((c) => (
                <div key={c.contentType} className="p-2.5">
                  <pre className="overflow-x-auto rounded bg-bg-input p-2 font-mono text-[11px] text-muted">{c.example ?? '—'}</pre>
                </div>
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

function TagSection({ tag, operations, baseUrl }: { tag: string; operations: OpenApiOperation[]; baseUrl: string }) {
  return (
    <div className="max-w-3xl space-y-8 p-6">
      <h1 className="text-[16px] font-semibold text-text">{tag}</h1>
      {operations.map((op) => (
        <div key={`${op.method} ${op.path}`} className="space-y-3 border-b border-border pb-8 last:border-b-0">
          <div>
            <div className="flex items-center gap-2">
              <MethodBadge method={op.method} />
              <span className="font-mono text-[13px] text-text">{op.path}</span>
            </div>
            {op.summary && <h2 className="mt-1 text-[13px] font-semibold text-text">{op.summary}</h2>}
            {op.description && op.description !== op.summary && <p className="mt-0.5 text-[12px] text-muted">{op.description}</p>}
          </div>
          <ParametersTable op={op} />
          <RequestBodySection op={op} />
          <ResponsesSection op={op} />
          <CodeSamplePanel op={op} baseUrl={baseUrl} />
        </div>
      ))}
    </div>
  )
}
