import { test, expect } from './fixtures'

test('starting the seeded mock server actually binds a real port and serves the designed response', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'Mock Servers', exact: true }).click()

  await window.getByRole('button', { name: 'Start', exact: true }).click()
  await expect(window.getByRole('button', { name: 'Stop', exact: true })).toBeVisible({ timeout: 10_000 })

  try {
    const res = await fetch('http://127.0.0.1:4010/users', { method: 'POST' })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ created: true })
  } finally {
    await window.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(window.getByRole('button', { name: 'Start', exact: true })).toBeVisible({ timeout: 10_000 })
  }
})
