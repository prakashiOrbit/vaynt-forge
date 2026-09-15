import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
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
const sqliteAlias = {
  find: '@apiforge/sqlite',
  replacement: fileURLToPath(new URL('../../packages/sqlite/src', import.meta.url)),
}

export default defineConfig({
  main: {
    plugins: [
      externalizeDepsPlugin({
        exclude: ['@apiforge/engine', '@apiforge/ui', '@apiforge/sqlite'],
      }),
    ],
    resolve: {
      alias: [engineAlias, uiAlias, sqliteAlias],
    },
    build: {
      rollupOptions: {
        input: { index: fileURLToPath(new URL('./src/main/index.ts', import.meta.url)) },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: fileURLToPath(new URL('./src/preload/index.ts', import.meta.url)) },
      },
    },
  },
  renderer: {
    root: fileURLToPath(new URL('./src/renderer', import.meta.url)),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [engineAlias, uiAlias],
    },
  },
})