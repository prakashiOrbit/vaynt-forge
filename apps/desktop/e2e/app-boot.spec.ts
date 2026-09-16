import { test, expect } from './fixtures'

test('a fresh launch seeds the real Acme API demo workspace and shows it on Home', async ({ window }) => {
  await expect(window.getByText('Welcome back')).toBeVisible()
  await expect(window.getByRole('button', { name: 'Switch workspace' })).toContainText('Acme API')
  await expect(window.getByText('Acme API · Development · 4 collections · 13 requests')).toBeVisible()
})

test('no console errors during boot and onboarding', ({ consoleErrors }) => {
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
})

test('the sidebar opens a real screen for every nav item, not a placeholder', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  const items = [
    'Requests',
    'Collections',
    'Tests',
    'Mock Servers',
    'OpenAPI',
    'History',
    'Console',
    'Performance',
    'WebSockets',
    'Environments',
    'Documentation',
  ]
  for (const label of items) {
    await nav.getByRole('button', { name: label, exact: true }).click()
    await expect(window.getByText(/coming soon|not implemented|placeholder/i)).toHaveCount(0)
  }
  await window.getByRole('complementary').getByRole('button', { name: 'Settings', exact: true }).click()
  await expect(window.getByText(/coming soon|not implemented|placeholder/i)).toHaveCount(0)
})
