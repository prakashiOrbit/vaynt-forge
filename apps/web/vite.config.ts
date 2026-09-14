import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

const engineAlias = {
  find: '@apiforge/engine',
  replacement: fileURLToPath(new URL('../../packages/engine/src', import.meta.url)),
}
const uiAlias = {
  find: '@apiforge/ui',
  replacement: fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [engineAlias, uiAlias],
  },
})