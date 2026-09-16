export type FlagSpec = Record<string, 'string' | 'array' | 'boolean'>

export interface ParsedArgs {
  positional: string[]
  flags: Record<string, string | string[] | boolean>
}

/**
 * A small hand-rolled parser (matching this codebase's existing preference
 * for hand-rolled parsers over a new dependency — see the CSV/dotenv/cURL
 * tokenizer precedents in `packages/engine/src/io` and `.../import`) rather
 * than pulling in `commander`/`yargs` for a handful of flags. Supports
 * `--flag value` and `--flag=value`; `array`-typed flags accumulate across
 * repeats (`--env-var A=1 --env-var B=2`).
 */
export function parseArgs(argv: string[], spec: FlagSpec): ParsedArgs {
  const positional: string[] = []
  const flags: Record<string, string | string[] | boolean> = {}

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!
    if (!arg.startsWith('--')) {
      positional.push(arg)
      continue
    }
    const eq = arg.indexOf('=')
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq)
    const type = spec[name]
    if (!type) throw new Error(`Unknown flag --${name}`)

    if (type === 'boolean') {
      flags[name] = true
      continue
    }

    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1)
    const value = inlineValue ?? argv[++i]
    if (value === undefined) throw new Error(`--${name} expects a value`)

    if (type === 'array') {
      const existing = flags[name]
      flags[name] = Array.isArray(existing) ? [...existing, value] : [value]
    } else {
      flags[name] = value
    }
  }

  return { positional, flags }
}
