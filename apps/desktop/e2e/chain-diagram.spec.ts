import { test, expect } from './fixtures'

test('the chain diagram visualizes request order and configured chain rules, and clicking a node jumps back to the Chain tab', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'Collections', exact: true }).click()

  await window.getByText('Users', { exact: true }).click({ button: 'right' })
  await window.getByRole('menuitem', { name: 'Run', exact: true }).click()

  // Configure a real chain rule on the first request via the existing Chain tab.
  await window.getByRole('tab', { name: 'Chain', exact: true }).click()
  const dialog = window.getByRole('dialog')
  const firstRow = dialog.locator('.rounded-md.border').first()
  await firstRow.locator('input[type="checkbox"]').check()
  await firstRow.getByPlaceholder('$.token').fill('$.id')
  await firstRow.getByPlaceholder('$.token').blur()
  await firstRow.getByPlaceholder('access_token').fill('extractedId')
  await firstRow.getByPlaceholder('access_token').blur()

  await window.getByRole('tab', { name: 'Diagram', exact: true }).click()
  await expect(dialog.getByText('{{extractedId}}')).toBeVisible()

  const nodes = dialog.locator('button').filter({ hasText: 'GET' }).or(dialog.locator('button').filter({ hasText: 'POST' }))
  const nodeCount = await nodes.count()
  expect(nodeCount).toBeGreaterThan(1)

  // Clicking any diagram node should jump back to the Chain tab and highlight that request's row.
  // The tab's accessible name includes its enabled-rule-count badge (e.g. "Chain 1"), so match a prefix.
  const clickedNodeText = await nodes.nth(1).innerText()
  await nodes.nth(1).click()
  await expect(window.getByRole('tab', { name: /^Chain/, selected: true })).toBeVisible()

  const requestName = clickedNodeText.split('\n').at(-1)
  const highlightedRow = dialog.locator('.border-accent').filter({ hasText: requestName ?? '' })
  await expect(highlightedRow).toBeVisible()
})
