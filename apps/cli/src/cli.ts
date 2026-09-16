import { readFileSync, writeFileSync } from 'node:fs'
import {
  generateId,
  parseCsv,
  deserializeEnvironmentFile,
  environmentFromFile,
} from '@vayntforge/engine'
import type { Environment } from '@vayntforge/engine'
import { runCollection } from '@vayntforge/engine/runner/collection-runner'
import { parseArgs } from './args'
import { defaultDbPath, openStorage } from './db'
import { findCollection, findEnvironment, findWorkspace } from './resolve'
import { applySecretOverrides, loadSecretsFile, parseEnvVarFlags } from './secrets'
import { printJson, printResultLine, printSummary } from './reporter'

const RUN_FLAGS = {
  db: 'string',
  workspace: 'string',
  collection: 'string',
  environment: 'string',
  'environment-file': 'string',
  data: 'string',
  iterations: 'string',
  delay: 'string',
  concurrency: 'string',
  bail: 'boolean',
  'env-var': 'array',
  secrets: 'string',
  reporter: 'string',
  'reporter-file': 'string',
  'no-save': 'boolean',
  help: 'boolean',
} as const

const HELP = `vaynt-forge run — headless collection runner (a Newman equivalent for Vaynt Forge)

Runs a real collection against the same real network client (undici, real
auth/proxy/certs/cookie-jar, real pre/post-request scripts) the desktop
app's Send button uses — reading straight out of the app's own SQLite data
file, so a CI run behaves exactly like a real send in the app.

Usage:
  vaynt-forge run --workspace <name-or-id> --collection <name-or-id> [options]

Options:
  --db <path>              Path to vayntforge.db (default: the same path the
                            desktop app uses for this OS user)
  --workspace <name-or-id>  Required.
  --collection <name-or-id> Required.
  --environment <name-or-id>  An environment already saved in that workspace.
  --environment-file <path>   A native Vaynt Forge environment export (.json)
                            to use instead of a saved environment — lets a
                            CI-only environment live in the repo without
                            touching the real app database.
  --data <path>             CSV or JSON-array data file — one iteration per row.
  --iterations <n>          Iteration count when there's no data file (default 1).
  --delay <ms>              Delay before each request (default 0).
  --concurrency <n>         Requests in flight at once (forced to 1 if any
                            chain rule on this collection is enabled).
  --bail                    Stop the run after the first failed request.
  --env-var KEY=VALUE       Override a secret variable's value (repeatable).
                            Required for any global/environment/collection
                            variable flagged "secret" — see below.
  --secrets <path>          A flat { "KEY": "value" } JSON file of the same
                            overrides, for more than a couple of secrets.
  --reporter <cli|json>     Output format (default cli).
  --reporter-file <path>    Also write the reporter output to this file.
  --no-save                 Don't write a TestRun back into the database
                            (by default, a CI run shows up in the app's own
                            Tests history too).
  --help                    Show this help.

Exit code is 0 only when every assertion in the run passed (0 failures).

A note on secrets: global, environment, and collection variables flagged
"secret" are encrypted at rest by the desktop app (via the OS keychain, and
only on platforms where that's available) — this CLI has no way to tell a
real ciphertext blob apart from plaintext written on a platform without
one, so it never trusts a "secret"-flagged variable's stored value
directly. Supply it via --env-var/--secrets, exactly like any other CI
secret.

The same encryption also applies to auth fields (a Bearer token, a Basic
password, an API key's value, etc.) and to any secret-flagged header/param/
body field — but those have no override mechanism here, since they aren't
keyed by a variable name. If a request hardcodes a real secret directly
into one of those instead of referencing it via {{aVariable}}, that field
will round-trip as ciphertext through this CLI. Referencing a variable
there (the way the app's own auth/variable system is meant to be used) is
both the more secure pattern and the one this CLI can actually resolve.
`

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2)

  if (command === '--version') {
    process.stdout.write('0.1.0\n')
    return
  }
  if (command !== 'run' || rest.includes('--help')) {
    process.stdout.write(HELP)
    process.exitCode = command === 'run' ? 0 : 1
    return
  }

  const { flags } = parseArgs(rest, RUN_FLAGS)
  const str = (name: string): string | undefined => (typeof flags[name] === 'string' ? (flags[name] as string) : undefined)

  const workspaceArg = str('workspace')
  const collectionArg = str('collection')
  if (!workspaceArg || !collectionArg) {
    throw new Error('--workspace and --collection are both required. Run with --help for usage.')
  }

  const dbPath = str('db') ?? defaultDbPath()
  const storage = openStorage(dbPath)

  const workspace = findWorkspace(storage.listWorkspaces(), workspaceArg)
  const collection = findCollection(storage.listCollections(workspace.id), collectionArg)
  const requests = storage.listRequests(workspace.id).filter((r) => r.collectionId === collection.id)
  if (requests.length === 0) throw new Error(`Collection "${collection.name}" has no requests.`)

  const foldersByCollection = { [collection.id]: storage.listFolders(collection.id) }

  const overrides = {
    ...(str('secrets') ? loadSecretsFile(str('secrets')!) : {}),
    ...parseEnvVarFlags((flags['env-var'] as string[] | undefined) ?? []),
  }
  const warnings: string[] = []
  const globalVariables = applySecretOverrides(storage.listGlobalVariables(workspace.id), overrides, (m) => warnings.push(m))
  // Collection variables get the exact same "secret" toggle and codec
  // treatment as global/environment ones (see the roadmap's Post-v1.0 log) —
  // override every collection in the workspace, not just the target one,
  // since a request's ancestor chain can reach any of them.
  const collections = storage.listCollections(workspace.id).map((c) => ({
    ...c,
    variables: c.variables ? applySecretOverrides(c.variables, overrides, (m) => warnings.push(`collection "${c.name}": ${m}`)) : c.variables,
  }))

  let environment: Environment | undefined
  const environmentFile = str('environment-file')
  const environmentArg = str('environment')
  if (environmentFile) {
    environment = environmentFromFile(deserializeEnvironmentFile(readFileSync(environmentFile, 'utf8')), workspace.id)
  } else if (environmentArg) {
    environment = findEnvironment(storage.listEnvironments(workspace.id), environmentArg)
  }
  if (environment) {
    environment = { ...environment, variables: applySecretOverrides(environment.variables, overrides, (m) => warnings.push(m)) }
  }
  for (const w of warnings) process.stderr.write(`warning: ${w}\n`)

  let dataRows: Record<string, unknown>[] | undefined
  const dataPath = str('data')
  if (dataPath) {
    const content = readFileSync(dataPath, 'utf8')
    const parsed = dataPath.toLowerCase().endsWith('.csv') ? parseCsv(content) : JSON.parse(content)
    if (!Array.isArray(parsed) || parsed.some((r) => typeof r !== 'object' || r === null)) {
      throw new Error('--data must be a JSON array of objects, or a CSV file (one row per iteration)')
    }
    dataRows = parsed as Record<string, unknown>[]
  }

  const settings = storage.getSettings(workspace.id)
  const network = settings
    ? {
        proxy: settings.proxy,
        caCertificates: settings.certificates.map((c) => c.pem),
        clientCertificates: settings.clientCertificates,
      }
    : undefined

  const reporter = str('reporter') ?? 'cli'
  if (reporter !== 'cli' && reporter !== 'json') throw new Error(`--reporter must be "cli" or "json", got "${reporter}"`)
  const iterationsFlag = str('iterations')
  const totalIterations = dataRows ? dataRows.length : Math.max(1, Number(iterationsFlag ?? '1'))

  const summary = await runCollection(
    {
      requests,
      collections,
      foldersByCollection,
      globalVariables,
      environment,
      iterations: totalIterations,
      delayMs: Number(str('delay') ?? '0'),
      concurrency: Number(str('concurrency') ?? '1'),
      dataRows,
      chainRules: collection.chainRules ?? [],
      network,
      bail: Boolean(flags.bail),
    },
    {
      onResult:
        reporter === 'cli' ? (result, iteration) => printResultLine(result, iteration, totalIterations) : undefined,
    }
  )

  const output = reporter === 'json' ? printJson(summary) : ''
  if (reporter === 'json') process.stdout.write(`${output}\n`)
  else printSummary(summary)

  const reporterFile = str('reporter-file')
  if (reporterFile) {
    writeFileSync(reporterFile, reporter === 'json' ? output : printJson(summary))
  }

  if (!flags['no-save']) {
    storage.saveTestRun({
      id: generateId('run'),
      name: `${collection.name} (CLI run)`,
      collectionId: collection.id,
      workspaceId: workspace.id,
      startedAt: summary.startedAt,
      finishedAt: summary.finishedAt,
      iterations: summary.iterations,
      passed: summary.passed,
      failed: summary.failed,
      skipped: summary.skipped,
      results: summary.results,
    })
  }

  process.exitCode = summary.failed > 0 ? 1 : 0
}

main().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exitCode = 1
})
