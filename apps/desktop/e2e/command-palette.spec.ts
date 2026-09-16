import { test, expect } from './fixtures'

test('the command palette opens, searches, and navigates to a real screen', async ({ window }) => {
  await window.getByRole('button', { name: 'Open command palette' }).click()
  const input = window.getByPlaceholder('Type a command or search...')
  await expect(input).toBeVisible()
  await input.fill('Settings')
  // The palette result button's accessible name is "Settings Open screen" (label + hint) —
  // matching on the hint avoids ambiguity with the TopBar's own icon-only "Settings" button,
  // which is earlier in DOM order (and visually hidden behind the palette's backdrop).
  await window.getByRole('button', { name: /Open screen/ }).click()
  await expect(window.getByRole('button', { name: 'About', exact: true })).toBeVisible()
  await expect(window.getByRole('heading', { name: 'General', level: 2 })).toBeVisible()
})
