/** Generate a short, URL-safe id for new entities (e.g. `req_4f3a9cd2`). */
export function generateId(prefix: string): string {
  const nonce = crypto.randomUUID().replaceAll('-', '').slice(0, 8)
  return `${prefix}_${nonce}`
}