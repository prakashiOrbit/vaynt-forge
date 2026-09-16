import { test, expect } from './fixtures'

const SWAGGER2_PETSTORE = {
  swagger: '2.0',
  info: { title: 'E2E Swagger2 Petstore', version: '1.0.0' },
  host: 'api.example.com',
  basePath: '/v1',
  schemes: ['https'],
  produces: ['application/json'],
  definitions: {
    Pet: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' } } },
  },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['Pets'],
        responses: { '200': { description: 'ok', schema: { type: 'array', items: { $ref: '#/definitions/Pet' } } } },
      },
      post: {
        operationId: 'createPet',
        tags: ['Pets'],
        parameters: [{ name: 'body', in: 'body', required: true, schema: { $ref: '#/definitions/Pet' } }],
        responses: { '201': { description: 'created', schema: { $ref: '#/definitions/Pet' } } },
      },
    },
  },
}

test('importing a real Swagger 2.0 document normalizes it, flags it in the UI, and generates a real, sendable collection', async ({ window }) => {
  const nav = window.getByRole('navigation', { name: 'Primary' })
  await nav.getByRole('button', { name: 'OpenAPI', exact: true }).click()

  const fileInput = window.locator('input[type="file"]')
  await fileInput.setInputFiles({
    name: 'swagger2-petstore.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(SWAGGER2_PETSTORE)),
  })

  await expect(window.getByRole('heading', { name: 'E2E Swagger2 Petstore', exact: true })).toBeVisible()
  await expect(window.getByText('Swagger 2.0 → converted', { exact: true })).toBeVisible()
  await expect(window.getByText('https://api.example.com/v1', { exact: true })).toBeVisible()

  await window.getByRole('button', { name: 'Generate Collection' }).click()

  const navCollections = window.getByRole('navigation', { name: 'Primary' })
  await navCollections.getByRole('button', { name: 'Collections', exact: true }).click()
  const tree = window.getByRole('tree')
  await tree.getByText('E2E Swagger2 Petstore', { exact: true }).click()
  await tree.getByText('Pets', { exact: true }).click()
  await tree.getByText('POST /pets', { exact: true }).click()

  // The Swagger 2 `in: "body"` parameter, resolved through its local $ref, should have become a
  // real JSON request body — not silently dropped or left as a bogus query/header parameter.
  const bodyTab = window.getByRole('tab', { name: 'Body', exact: true })
  await bodyTab.click()
  await expect(window.getByText('"id"')).toBeVisible()
  await expect(window.getByText('"name"')).toBeVisible()
})
