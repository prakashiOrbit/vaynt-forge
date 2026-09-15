import type { AuthConfig, HttpMethod, KeyValuePair, RequestBody } from '../types/request'
import type { MockEndpoint } from '../types/mock'
import type { ParsedOpenApiSpec, OpenApiOperation } from './types'

const HTTP_METHODS = new Set<HttpMethod>(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])

function toVaryntUrl(baseUrl: string, path: string): string {
  const varPath = path.replace(/\{(\w+)\}/g, '{{$1}}')
  return `${baseUrl.replace(/\/$/, '')}${varPath}`
}

function pair(key: string, value: string): KeyValuePair {
  return { id: crypto.randomUUID(), key, value, enabled: true }
}

function bodyFor(op: OpenApiOperation): RequestBody {
  if (!op.requestBody) return { type: 'none' }
  const isJson = op.requestBody.contentType.includes('json')
  return isJson
    ? { type: 'raw', language: 'json', content: op.requestBody.example ?? '{}' }
    : { type: 'raw', language: 'text', content: op.requestBody.example ?? '' }
}

/** A request "plan" — everything but the storage identity fields, which the
 * caller assigns after creating the real collection/folder (engine stays I/O-free). */
export type PlannedRequest = {
  name: string
  method: HttpMethod
  url: string
  params: KeyValuePair[]
  headers: KeyValuePair[]
  auth: AuthConfig
  body: RequestBody
  assertions: { id: string; type: 'statusCodeEquals'; target: string; expected: string; enabled: boolean }[]
  variables: KeyValuePair[]
}

export interface GeneratedRequestGroup {
  tag: string
  requests: PlannedRequest[]
}

export interface CollectionPlan {
  name: string
  description?: string
  groups: GeneratedRequestGroup[]
}

function firstSuccessStatus(op: OpenApiOperation): string {
  const success = op.responses.find((r) => /^2\d\d$/.test(r.status))
  return success?.status ?? '200'
}

/** Plans a single operation as a request — the same conversion `planCollectionFromSpec`
 * applies per-operation, exposed standalone for a one-off "Send Request" from the Explorer. */
export function planRequestFromOperation(op: OpenApiOperation, baseUrl: string): PlannedRequest {
  return operationToRequest(op, baseUrl)
}

function operationToRequest(op: OpenApiOperation, baseUrl: string): PlannedRequest {
  const method = HTTP_METHODS.has(op.method as HttpMethod) ? (op.method as HttpMethod) : 'GET'
  const headerParams = op.parameters.filter((p) => p.in === 'header')
  const queryParams = op.parameters.filter((p) => p.in === 'query')
  const headers = headerParams.map((p) => pair(p.name, p.example ?? ''))
  if (op.requestBody) headers.push(pair('Content-Type', op.requestBody.contentType))

  return {
    name: op.summary || `${op.method} ${op.path}`,
    method,
    url: toVaryntUrl(baseUrl, op.path),
    params: queryParams.map((p) => pair(p.name, p.example ?? '')),
    headers,
    auth: { type: 'none' },
    body: bodyFor(op),
    assertions: [
      {
        id: crypto.randomUUID(),
        type: 'statusCodeEquals',
        target: 'status',
        expected: firstSuccessStatus(op),
        enabled: true,
      },
    ],
    variables: [],
  }
}

/** Groups operations by their first tag and builds request plans — pure, no I/O. */
export function planCollectionFromSpec(spec: ParsedOpenApiSpec, baseUrl: string): CollectionPlan {
  const groups = new Map<string, PlannedRequest[]>()
  for (const op of spec.operations) {
    const tag = op.tags[0] ?? 'General'
    const list = groups.get(tag) ?? []
    list.push(operationToRequest(op, baseUrl))
    groups.set(tag, list)
  }
  return {
    name: spec.info.title,
    description: spec.info.description,
    groups: [...groups.entries()].map(([tag, requests]) => ({ tag, requests })),
  }
}

/** Builds mock endpoints from every operation — Express-style `:param` paths, matching the existing MockEndpoint convention. */
export function planMockEndpointsFromSpec(spec: ParsedOpenApiSpec): MockEndpoint[] {
  return spec.operations.map((op) => {
    const status = firstSuccessStatus(op)
    const successResponse = op.responses.find((r) => r.status === status)
    const jsonContent = successResponse?.content.find((c) => c.contentType.includes('json'))
    return {
      id: crypto.randomUUID(),
      method: op.method,
      path: op.path.replace(/\{(\w+)\}/g, ':$1'),
      status: Number(status) || 200,
      headers: { 'content-type': jsonContent?.contentType ?? 'application/json' },
      body: jsonContent?.example ?? '{}',
      delayMs: 100,
      errorRate: 0,
    }
  })
}

// ── Code samples ─────────────────────────────────────────────────────────

export interface CodeSampleRequest {
  method: string
  url: string
  headers: { key: string; value: string }[]
  body?: string
}

export type CodeSampleLanguage = 'curl' | 'javascript' | 'python' | 'java' | 'go'

export const CODE_SAMPLE_LANGUAGES: { id: CodeSampleLanguage; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
]

function curlSample(r: CodeSampleRequest): string {
  const parts = [`curl -X ${r.method} '${r.url}'`]
  for (const h of r.headers) parts.push(`-H '${h.key}: ${h.value}'`)
  if (r.body) parts.push(`--data '${r.body.replace(/'/g, "'\\''")}'`)
  return parts.join(' \\\n  ')
}

function javascriptSample(r: CodeSampleRequest): string {
  const headers = r.headers.map((h) => `    '${h.key}': '${h.value}'`).join(',\n')
  const bodyLine = r.body ? `,\n  body: JSON.stringify(${r.body})` : ''
  return `const response = await fetch('${r.url}', {
  method: '${r.method}',
  headers: {
${headers}
  }${bodyLine}
});
const data = await response.json();
console.log(data);`
}

function pythonSample(r: CodeSampleRequest): string {
  const headers = r.headers.map((h) => `    '${h.key}': '${h.value}'`).join(',\n')
  const bodyLine = r.body ? `, json=${r.body}` : ''
  return `import requests

response = requests.request(
    '${r.method}',
    '${r.url}',
    headers={
${headers}
    }${bodyLine}
)
print(response.json())`
}

function javaSample(r: CodeSampleRequest): string {
  const headerCalls = r.headers.map((h) => `    .header("${h.key}", "${h.value}")`).join('\n')
  const bodyMethod = r.body
    ? `.method("${r.method}", HttpRequest.BodyPublishers.ofString(${JSON.stringify(r.body)}))`
    : `.method("${r.method}", HttpRequest.BodyPublishers.noBody())`
  return `HttpClient client = HttpClient.newHttpClient();
HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("${r.url}"))
${headerCalls}
    ${bodyMethod}
    .build();

HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
System.out.println(response.body());`
}

function goSample(r: CodeSampleRequest): string {
  const headerLines = r.headers.map((h) => `\treq.Header.Set("${h.key}", "${h.value}")`).join('\n')
  const bodyVar = r.body ? `strings.NewReader(\`${r.body}\`)` : 'nil'
  return `package main

import (
\t"fmt"
\t"io"
\t"net/http"
\t"strings"
)

func main() {
\treq, _ := http.NewRequest("${r.method}", "${r.url}", ${bodyVar})
${headerLines}

\tresp, err := http.DefaultClient.Do(req)
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()
\tbody, _ := io.ReadAll(resp.Body)
\tfmt.Println(string(body))
}`
}

export function generateCodeSample(request: CodeSampleRequest, language: CodeSampleLanguage): string {
  switch (language) {
    case 'curl':
      return curlSample(request)
    case 'javascript':
      return javascriptSample(request)
    case 'python':
      return pythonSample(request)
    case 'java':
      return javaSample(request)
    case 'go':
      return goSample(request)
  }
}
