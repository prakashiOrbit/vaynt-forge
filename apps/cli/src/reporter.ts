import type { CollectionRunSummary } from '@vayntforge/engine/runner/collection-runner'
import type { TestRunRequestResult } from '@vayntforge/engine'

const useColor = process.stdout.isTTY && !process.env.NO_COLOR
const color = (code: string, s: string): string => (useColor ? `[${code}m${s}[0m` : s)
const green = (s: string) => color('32', s)
const red = (s: string) => color('31', s)
const gray = (s: string) => color('90', s)
const bold = (s: string) => color('1', s)

const ICON: Record<TestRunRequestResult['status'], string> = { pass: green('✓'), fail: red('✗'), skip: gray('−') }

export function printResultLine(result: TestRunRequestResult, iteration: number, iterations: number): void {
  const suffix = iterations > 1 ? gray(` [iter ${iteration + 1}/${iterations}]`) : ''
  const timing = gray(`${result.durationMs}ms`)
  const error = result.error ? ` ${red(result.error)}` : ''
  process.stdout.write(`  ${ICON[result.status]} ${result.requestName}${suffix} ${timing}${error}\n`)
}

export function printSummary(summary: CollectionRunSummary): void {
  const durationS = ((summary.finishedAt - summary.startedAt) / 1000).toFixed(2)
  process.stdout.write('\n')
  process.stdout.write(
    `${bold('Run complete')} in ${durationS}s — ${green(`${summary.passed} passed`)}, ${red(`${summary.failed} failed`)}` +
      (summary.skipped > 0 ? `, ${gray(`${summary.skipped} skipped`)}` : '') +
      '\n'
  )
  if (summary.failed > 0) {
    process.stdout.write('\nFailed requests:\n')
    for (const r of summary.results.filter((r) => r.status === 'fail')) {
      process.stdout.write(`  ${red('✗')} ${r.requestName}${r.error ? ` — ${r.error}` : ''}\n`)
    }
  }
}

export function printJson(summary: CollectionRunSummary): string {
  return JSON.stringify(summary, null, 2)
}
