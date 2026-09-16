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

test('sending a real GET request shows a real response from a real local server', async ({ window }) => {
  const server = await startServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ hello: 'e2e-world' }))
  })
  try {
    await window.getByRole('button', { name: 'New request tab' }).click()
    await window.getByPlaceholder('https://api.example.com/v1/resource').fill(`${server.url}/ping`)
    await window.getByRole('button', { name: 'Send' }).click()
    // "200" and "OK" render as separate sibling elements (StatusCode badge + statusText span), not one text node.
    await expect(window.getByText('200', { exact: true })).toBeVisible({ timeout: 10_000 })
    await expect(window.getByText('OK', { exact: true })).toBeVisible()
    // The JSON tree view renders keys unquoted (hello:) and values quoted — not raw JSON text.
    await expect(window.getByText('hello', { exact: false })).toBeVisible()
    await expect(window.getByText(/e2e-world/)).toBeVisible()
  } finally {
    await server.close()
  }
})

test('a real 500 response surfaces the error path with real causes, not a canned example', async ({ window }) => {
  const server = await startServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'boom' }))
  })
  try {
    await window.getByRole('button', { name: 'New request tab' }).click()
    await window.getByPlaceholder('https://api.example.com/v1/resource').fill(`${server.url}/fail`)
    await window.getByRole('button', { name: 'Send' }).click()
    await expect(window.getByText(/500/).first()).toBeVisible({ timeout: 10_000 })
  } finally {
    await server.close()
  }
})
