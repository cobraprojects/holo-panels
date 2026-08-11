import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const workspaceModules = fileURLToPath(new URL('../../node_modules/', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-dom\/(.+)$/u, replacement: `${workspaceModules}react-dom/$1` },
      { find: /^react\/(.+)$/u, replacement: `${workspaceModules}react/$1` },
      { find: /^react$/u, replacement: `${workspaceModules}react` },
      { find: /^react-dom$/u, replacement: `${workspaceModules}react-dom` },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
})
