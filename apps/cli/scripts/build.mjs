import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { chmodSync } from 'node:fs'

/**
 * Bundles the CLI into one self-contained `dist/cli.js`, the same way
 * `apps/desktop`'s `electron.vite.config.ts` bundles the main process: alias
 * `@vayntforge/engine`/`@vayntforge/sqlite` straight to their `src`, so the
 * CLI runs from real, current source rather than depending on those
 * packages' own `dist` builds resolving correctly via plain Node ESM (they
 * don't yet — a real, previously-invisible gap this CLI's build surfaced:
 * relative imports like `./types` need an explicit `.js`/`/index.js` for
 * Node's ESM resolver, which neither package's source currently has, since
 * nothing before this CLI ever executed their `dist` output directly).
 * True npm dependencies (undici/ajv/js-yaml) stay external — real
 * dependencies of `@vayntforge/engine`, resolved from the workspace root's
 * `node_modules` at runtime, same as any other installed package.
 */

const engineSrc = fileURLToPath(new URL('../../../packages/engine/src', import.meta.url))
const sqliteSrc = fileURLToPath(new URL('../../../packages/sqlite/src', import.meta.url))

await build({
  entryPoints: [fileURLToPath(new URL('../src/cli.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('../dist/cli.js', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  legalComments: 'none',
  external: ['undici', 'ajv', 'js-yaml'],
  alias: {
    '@vayntforge/engine': `${engineSrc}/index.ts`,
    '@vayntforge/engine/networking/http-client': `${engineSrc}/networking/http-client.ts`,
    '@vayntforge/engine/scripting/sandbox': `${engineSrc}/scripting/sandbox.ts`,
    '@vayntforge/engine/runner/collection-runner': `${engineSrc}/runner/collection-runner.ts`,
    '@vayntforge/sqlite': `${sqliteSrc}/index.ts`,
  },
  banner: { js: '#!/usr/bin/env node' },
})

// esbuild doesn't preserve the executable bit; npm's bin symlink needs it.
chmodSync(fileURLToPath(new URL('../dist/cli.js', import.meta.url)), 0o755)

console.log('Built dist/cli.js')
