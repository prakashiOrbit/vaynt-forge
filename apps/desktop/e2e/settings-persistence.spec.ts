import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test, expect, _electron as electron } from '@playwright/test'

const mainPath = join(__dirname, '../out/main/index.js')

test('a theme change survives a full app restart against the same user-data-dir', async () => {
  const userDataDir = mkdtempSync(join(tmpdir(), 'vayntforge-e2e-'))
  try {
    const first = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] })
    const firstWindow = await first.firstWindow()
    await firstWindow.getByRole('button', { name: /Start with Demo Workspace/i }).click()
    await firstWindow.getByText('Welcome back').waitFor()

    await expect(firstWindow.locator('html')).toHaveAttribute('data-theme', 'dark')
    await firstWindow.getByRole('button', { name: 'Theme' }).click()
    await firstWindow.getByRole('button', { name: 'Light', exact: true }).click()
    await expect(firstWindow.locator('html')).toHaveAttribute('data-theme', 'light')
    await first.close()

    const second = await electron.launch({ args: [mainPath, `--user-data-dir=${userDataDir}`] })
    const secondWindow = await second.firstWindow()
    // Onboarding is skipped this time — `onboardingComplete` persisted from the first launch.
    await secondWindow.getByText('Welcome back').waitFor()
    await expect(secondWindow.locator('html')).toHaveAttribute('data-theme', 'light')
    await second.close()
  } finally {
    rmSync(userDataDir, { recursive: true, force: true })
  }
})
