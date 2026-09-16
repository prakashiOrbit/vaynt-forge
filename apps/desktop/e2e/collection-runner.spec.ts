import { test, expect } from './fixtures'

test('running a seeded collection shows live progress and a real pass/fail summary', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'Collections', exact: true }).click()

  await window.getByText('Payments', { exact: true }).click({ button: 'right' })
  await window.getByRole('menuitem', { name: 'Run', exact: true }).click()

  await window.getByRole('button', { name: 'Run collection', exact: true }).click()
  await expect(window.getByRole('dialog').getByText('Run complete')).toBeVisible({ timeout: 15_000 })
  await expect(window.getByRole('dialog').getByText(/passed/)).toBeVisible()
  await expect(window.getByRole('dialog').getByText(/failed/)).toBeVisible()
})
