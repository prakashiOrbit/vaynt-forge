import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

const mainPath = join(__dirname, '../out/main/index.js')

interface Fixtures {
  electronApp: ElectronApplication
  /** Populated from the moment the first window exists — captures anything logged during onboarding too, not just after. */
  consoleErrors: string[]
  window: Page
}

/**
 * Launches the real built app (not the dev server) against a fresh,
 * isolated `--user-data-dir` per test — Electron/Chromium honor that switch
 * automatically before any app code runs, so this app's own `StorageService`
 * sees an empty db, seeds the real "Acme API" demo data (same as a genuine
 * first launch), and never touches the developer's own real app data.
 * Clicks through onboarding to the demo workspace so every spec starts from
 * the same known state.
 */
export const test = base.extend<Fixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), 'vayntforge-e2e-'))
    const app = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] })
    await use(app)
    await app.close()
    rmSync(userDataDir, { recursive: true, force: true })
  },
  // eslint-disable-next-line no-empty-pattern
  consoleErrors: async ({}, use) => {
    await use([])
  },
  window: async ({ electronApp, consoleErrors }, use) => {
    const window = await electronApp.firstWindow()
    window.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    await window.getByRole('button', { name: /Start with Demo Workspace/i }).click()
    await window.getByText('Welcome back').waitFor()
    await use(window)
  },
})

export { expect } from '@playwright/test'
