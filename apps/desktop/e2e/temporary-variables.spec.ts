import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { test, expect } from './fixtures'

function startServer(handler: http.RequestListener): Promise<{ url: string; close(): Promise<void> }> {
  const server = http.createServer(handler)
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(() => r())) })
    })
  })
}

test('a temporary variable, created in its own scope panel, actually resolves in a real sent request', async ({ window }) => {
  let receivedHeader: string | undefined
  const server = await startServer((req, res) => {
    receivedHeader = req.headers['x-session-token'] as string | undefined
    res.writeHead(200, {})
    res.end()
  })
  try {
    const nav = window.getByRole('navigation', { name: 'Primary' })
    await nav.getByRole('button', { name: 'Environments', exact: true }).click()

    await window.getByRole('button', { name: /^Temporary/ }).click()
    await window.getByRole('button', { name: 'Add variable' }).click()
    // Columns are Key(0) / Initial value(1) / Current value(2) / Secret(3) —
    // resolution reads currentValue, not initialValue, so both need setting.
    const row = window.locator('div.grid').filter({ has: window.locator('input') }).last()
    await row.locator('input').nth(0).fill('sessionToken')
    await row.locator('input').nth(0).blur()
    await row.locator('input').nth(1).fill('temp-abc-123')
    await row.locator('input').nth(1).blur()
    await row.locator('input').nth(2).fill('temp-abc-123')
    await row.locator('input').nth(2).blur()

    await nav.getByRole('button', { name: 'Requests', exact: true }).click()
    await window.getByRole('button', { name: 'New request tab' }).click()
    await window.getByPlaceholder('https://api.example.com/v1/resource').fill(server.url)
    await window.getByRole('tab', { name: 'Headers' }).click()
    await window.getByRole('button', { name: 'Add header' }).click()
    await window.getByPlaceholder('Header').fill('X-Session-Token')
    await window.getByPlaceholder('Value').fill('{{sessionToken}}')
    await window.getByPlaceholder('Value').blur()

    await window.getByRole('button', { name: 'Send' }).click()
    await expect(window.getByText('200', { exact: true })).toBeVisible({ timeout: 10_000 })
    expect(receivedHeader).toBe('temp-abc-123')
  } finally {
    await server.close()
  }
})
