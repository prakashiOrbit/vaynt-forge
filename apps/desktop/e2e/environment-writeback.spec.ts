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

test('pm.environment.set() in a post-response script really persists into the active environment', async ({ window }) => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ token: 'e2e-persisted-token' }))
  })
  try {
    await window.getByRole('button', { name: 'New request tab' }).click()
    await window.getByPlaceholder('https://api.example.com/v1/resource').fill(`${server.url}/login`)

    await window.getByRole('tab', { name: 'Scripts' }).click()
    // Pre-request and Post-response are two always-visible CodeMirror editors on
    // this one tab (not sub-tabs) — scope to the one under the "Post-response
    // Script" label specifically, rather than guessing by DOM position.
    const postResponseSection = window.locator('label', { hasText: 'Post-response Script' }).locator('xpath=../..')
    await postResponseSection.locator('.cm-content').click()
    await window.keyboard.type("pm.environment.set('e2eToken', pm.response.json().token)")

    await window.getByRole('button', { name: 'Send' }).click()
    await expect(window.getByText('200', { exact: true })).toBeVisible({ timeout: 10_000 })

    const nav = window.getByRole('navigation', { name: 'Primary' })
    await nav.getByRole('button', { name: 'Environments', exact: true }).click()
    // The list item's accessible name is "Development 4" (label + variable count) —
    // distinct from the TopBar's environment selector, whose name is plain "Development".
    await window.getByRole('button', { name: /^Development \d/ }).click()
    // Key/value cells are editable <input> elements, not plain text —
    // getByText() never matches an input's value.
    await expect(window.locator('input[value="e2eToken"]')).toBeVisible({ timeout: 10_000 })
    // A brand-new variable's Initial and Current Value start equal, so both columns match.
    await expect(window.locator('input[value="e2e-persisted-token"]').first()).toBeVisible()
  } finally {
    await server.close()
  }
})
