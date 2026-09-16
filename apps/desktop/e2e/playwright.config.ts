import { defineConfig } from '@playwright/test'

/**
 * Real Playwright Electron E2E suite — the first *committed*, CI-gated one.
 * Every live-app check across all 14 sprints (and every session since) was
 * a disposable scratch script, run once and deleted; nothing caught a real
 * UI regression automatically. This runs against the actual built app
 * (`npm run build` first — see `package.json`'s `test:e2e` script), the
 * same artifact a release would ship, not the dev server.
 *
 * `workers: 1`: each test launches its own whole Electron process with an
 * isolated `--user-data-dir` (see fixtures.ts), so there's no shared-state
 * risk between tests — but a couple of specs bind a real mock-server port
 * from the seeded demo data, and running those concurrently across workers
 * would flake on port collisions for no real benefit at this suite's size.
 */
export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  forbidOnly: Boolean(process.env['CI']),
})
