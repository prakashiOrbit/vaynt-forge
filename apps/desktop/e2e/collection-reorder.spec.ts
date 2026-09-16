import type { Page } from '@playwright/test'
import { test, expect } from './fixtures'

async function collectionOrder(window: Page): Promise<string[]> {
  const names = await window
    .getByRole('tree')
    .locator('[role="treeitem"][aria-level="1"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label') ?? el.textContent ?? ''))
  return names.map((n) => n.replace(/^Expand /, ''))
}

test('dragging a collection to a new position reorders it, and the new order survives a reload', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'Collections', exact: true }).click()

  expect(await collectionOrder(window)).toEqual(['Authentication', 'Users', 'Orders', 'Payments'])

  // Drop on the top edge of "Users", not its center — center reads as "drop
  // *into* Users" (as a child), which this app doesn't support for
  // collections; the top edge reads as "insert before Users" (a reorder).
  const usersRow = window.getByRole('treeitem', { name: /Users/ })
  const box = await usersRow.boundingBox()
  await window
    .getByRole('treeitem', { name: /Payments/ })
    .dragTo(usersRow, { targetPosition: { x: (box?.width ?? 100) / 2, y: 2 } })

  await expect.poll(() => collectionOrder(window)).toEqual(['Authentication', 'Payments', 'Users', 'Orders'])

  // Reload the renderer (re-fetches from the real, persisted SQLite db) —
  // proves the drag wrote through storage, not just local tree state.
  await window.reload()
  await window.getByText('Welcome back').waitFor()
  await nav.getByRole('button', { name: 'Collections', exact: true }).click()
  expect(await collectionOrder(window)).toEqual(['Authentication', 'Payments', 'Users', 'Orders'])
})
