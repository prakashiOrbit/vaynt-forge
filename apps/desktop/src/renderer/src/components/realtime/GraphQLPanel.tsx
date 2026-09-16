import { useMemo, useState } from 'react'
import { Play, RotateCcw, Braces, Sparkles, Loader2 } from 'lucide-react'
import { Button, JsonTreeView, KeyValueEditor, Tabs } from '@vayntforge/ui'
import type { TabItem } from '@vayntforge/ui'
import { formatGraphQL, graphqlIntrospection } from '@vayntforge/engine'
import type { Environment, GraphQLObjectType, GraphQLTypeRef, Variable } from '@vayntforge/engine'
import { useRealtime } from '../../stores/realtime'

function TypeRefLabel({ type }: { type: GraphQLTypeRef }) {
  const tone = type.kind === 'object' ? 'text-accent-2' : type.kind === 'enum' ? 'text-warn' : 'text-faint'
  return <span className={`font-mono text-[11px] font-semibold ${tone}`}>{type.name}</span>
}

function SchemaExplorer() {
  const schema = useMemo(() => graphqlIntrospection(), [])
  const objectTypes = schema.types.filter((t): t is GraphQLObjectType => t.kind === 'object')
  const rootNames = [schema.queryType, schema.mutationType, schema.subscriptionType].filter(Boolean) as string[]
  const roots = objectTypes.filter((t) => rootNames.includes(t.name))
  const others = objectTypes.filter((t) => !rootNames.includes(t.name))

  return (
    <div className="min-h-0 flex-1 overflow-auto p-2 text-[12px]">
      {roots.map((type) => (
        <div key={type.name} className="mb-3">
          <div className="mb-1 flex items-center gap-1.5">
            <TypeRefLabel type={type} />
            <span className="text-[10px] uppercase text-faint">
              {type.name === schema.mutationType ? 'mutation' : type.name === schema.subscriptionType ? 'subscription' : 'query'}
            </span>
          </div>
          <div className="space-y-0.5 pl-3">
            {type.fields.map((f) => (
              <div key={f.name} className="flex items-baseline gap-1.5 font-mono text-[11px]">
                <span className="text-text">{f.name}</span>
                {f.args && f.args.length > 0 && (
                  <span className="text-faint">({f.args.map((a) => a.name).join(', ')})</span>
                )}
                <span className="text-faint">: {f.type}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className="mb-1 mt-2 text-[10px] font-semibold uppercase text-faint">Types</div>
      <div className="space-y-2 pl-1">
        {others.map((type) => (
          <div key={type.name}>
            <TypeRefLabel type={type} />
            <div className="space-y-0.5 pl-3">
              {type.fields.map((f) => (
                <div key={f.name} className="font-mono text-[11px] text-faint">
                  {f.name}: <span className="text-text">{f.type}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function GraphQLPanel({
  tabId,
  workspaceId,
  globalVariables,
  environment,
}: {
  tabId: string
  workspaceId: string
  globalVariables: Variable[]
  environment?: Environment
}) {
  const gql = useRealtime((s) => s.getGql(tabId))
  const executeGql = useRealtime((s) => s.executeGql)
  const clearGql = useRealtime((s) => s.clearGql)
  const setGqlEndpoint = useRealtime((s) => s.setGqlEndpoint)
  const setGqlHeaders = useRealtime((s) => s.setGqlHeaders)
  const [query, setQuery] = useState(gql.query)
  const [variables, setVariables] = useState(gql.variables)
  const [rightTab, setRightTab] = useState<'response' | 'schema' | 'headers'>('response')
  const rightTabs: TabItem<'response' | 'schema' | 'headers'>[] = [
    { id: 'response', label: 'Response' },
    { id: 'schema', label: 'Schema' },
    { id: 'headers', label: 'Headers' },
  ]

  const handleExecute = () => {
    void executeGql(tabId, query, variables, { workspaceId, globalVariables, environment })
  }
  const handleFormat = () => setQuery((q) => formatGraphQL(q))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-3 py-2">
        <Braces className="h-3.5 w-3.5 text-faint" />
        <span className="text-[12px] font-medium text-text">GraphQL</span>
        <input
          value={gql.endpoint}
          onChange={(e) => setGqlEndpoint(tabId, e.target.value)}
          className="w-64 rounded border border-border bg-bg px-2 py-1 font-mono text-[11px] text-text"
          placeholder="https://api.example.dev/graphql"
        />
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => { clearGql(tabId); setQuery(''); setVariables('') }}>
            <RotateCcw className="h-3 w-3" /> Clear
          </Button>
          <Button size="sm" onClick={handleExecute} disabled={gql.sending || !gql.endpoint}>
            {gql.sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {gql.sending ? 'Running…' : 'Execute'}
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_1fr] gap-px bg-border">
        <div className="flex min-h-0 flex-col bg-bg p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-faint">Query</span>
            <Button size="sm" variant="ghost" onClick={handleFormat} title="Pretty-print the query">
              <Sparkles className="h-3 w-3" /> Format
            </Button>
          </div>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-0 flex-1 resize-none rounded border border-border bg-bg p-2 font-mono text-[12px] text-text"
            spellCheck={false}
          />
          <div className="mt-1 text-[11px] font-semibold uppercase text-faint">Variables</div>
          <textarea
            value={variables}
            onChange={(e) => setVariables(e.target.value)}
            className="h-16 resize-none rounded border border-border bg-bg p-2 font-mono text-[12px] text-text"
            placeholder='{"id": "ord_902"}'
            spellCheck={false}
          />
        </div>
        <div className="flex min-h-0 flex-col bg-bg">
          <Tabs<'response' | 'schema' | 'headers'> active={rightTab} onChange={setRightTab} tabs={rightTabs} />
          {rightTab === 'schema' ? (
            <SchemaExplorer />
          ) : rightTab === 'headers' ? (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <KeyValueEditor
                rows={gql.headers}
                onChange={(rows) => setGqlHeaders(tabId, rows)}
                keyPlaceholder="Header"
                valuePlaceholder="Value"
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[12px]">
              {!gql.result ? (
                <div className="text-faint">Execute a query to see results</div>
              ) : gql.result.errors ? (
                <pre className="break-all whitespace-pre-wrap text-err">
                  {JSON.stringify(gql.result.errors, null, 2)}
                </pre>
              ) : (
                <JsonTreeView data={gql.result.data} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
