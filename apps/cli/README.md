# @vayntforge/cli

A headless collection runner — Vaynt Forge's equivalent of Postman's Newman.
Runs a real collection against the same real network client (`undici`, real
auth/proxy/certs/cookie-jar, real pre/post-request scripts) the desktop
app's Send button uses, reading straight out of the app's own SQLite data
file. A CI run behaves exactly like a real send in the app — no separate
mock/simulation path.

## Build

```
npm run build --workspace=@vayntforge/cli
```

Produces a single self-contained `dist/cli.js` (bundled via esbuild —
`@vayntforge/engine`/`@vayntforge/sqlite` are aliased straight to their
`src`, the same way `apps/desktop`'s `electron.vite.config.ts` does, since
neither package's own `dist` build currently resolves via plain Node ESM —
see the comment in `scripts/build.mjs`).

## Usage

```
node dist/cli.js run --workspace <name-or-id> --collection <name-or-id> [options]
```

Run `node dist/cli.js run --help` for the full option list. Highlights:

- `--db <path>` — defaults to the same `vayntforge.db` path the desktop app
  uses for the current OS user; point it at any exported/copied data file
  otherwise (e.g. a checked-out copy in CI).
- `--environment-file <path.json>` — use a native Vaynt Forge environment
  export instead of a saved environment, so a CI-only environment can live
  in the repo without touching the real app database.
- `--data <path.csv|.json>` — one iteration per row, same format the GUI
  Collection Runner accepts.
- `--env-var KEY=VALUE` / `--secrets <path.json>` — required to supply any
  global/environment variable flagged `secret`. Only global and environment
  variables are ever encrypted at rest by the desktop app (via the OS
  keychain, and only where one exists) — this CLI has no way to tell a real
  ciphertext blob apart from plaintext written where no keychain was
  available, so it never trusts a secret-flagged variable's stored value
  directly. Supply it the same way any other CI secret would be.
- Exit code is `0` only when every assertion in the run passed.
- A `TestRun` is written back into the real database by default (so a CI
  run shows up in the app's own Tests history) — pass `--no-save` to skip.

## Known gaps

- Only global/environment secrets have the override mechanism above.
  Collection variables and request auth fields are stored plaintext in the
  app itself today regardless of any "secret" toggle — a separate, real gap
  in the app, not introduced by this CLI, but worth knowing about before
  putting a real credential there.
- Each run starts with an empty cookie jar (matching Newman's default) —
  it doesn't read or write the app's persisted jar.
- `pm.environment.set()` writeback is send-scoped only, same as the GUI —
  it isn't persisted back into the real environment.
