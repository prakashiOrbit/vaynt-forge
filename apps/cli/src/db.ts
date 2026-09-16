import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SQLiteStorage } from '@vayntforge/sqlite'

/**
 * The same path Electron's `app.getPath('userData')` resolves to for this
 * app's `productName` (`vaynt-forge`) — see `apps/desktop/src/main/index.ts`
 * (`join(app.getPath('userData'), 'vayntforge.db')`). Duplicated here rather
 * than imported since it's a plain path convention, not exported engine
 * logic, and Electron's own `app` module isn't available in a plain Node
 * process.
 */
export function defaultDbPath(): string {
  const home = homedir()
  switch (process.platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'vaynt-forge', 'vayntforge.db')
    case 'win32':
      return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'vaynt-forge', 'vayntforge.db')
    default:
      return join(process.env.XDG_CONFIG_HOME ?? join(home, '.config'), 'vaynt-forge', 'vayntforge.db')
  }
}

/**
 * Opens the real app database directly — no seeding, no writes beyond what
 * the run itself does (optionally saving a `TestRun`). `node:sqlite`'s
 * `DatabaseSync` creates an empty file by default when the path doesn't
 * exist, which would silently turn a typo'd `--db` path into a confusing
 * "workspace not found" a layer up — checked explicitly here so the real
 * failure (wrong path) is what gets reported.
 */
export function openStorage(dbPath: string): SQLiteStorage {
  if (!existsSync(dbPath)) {
    throw new Error(
      `No database file at ${dbPath}. Point --db at a real Vaynt Forge data file (run the desktop app at least ` +
        `once to create one), or pass the correct path explicitly.`
    )
  }
  return new SQLiteStorage({ path: dbPath })
}
