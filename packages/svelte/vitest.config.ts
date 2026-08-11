import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  plugins: [svelte()],
  resolve: {
    alias: [
      { find: /^svelte\/internal\/client$/u, replacement: resolve(import.meta.dirname, 'node_modules/svelte/src/internal/client/index.js') },
      { find: /^svelte$/u, replacement: resolve(import.meta.dirname, 'node_modules/svelte/src/index-client.js') },
    ],
    dedupe: ['svelte'],
  },
  ssr: {
    noExternal: ['bits-ui', 'runed', 'svelte-toolbelt'],
    optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    server: { deps: { inline: ['bits-ui', 'runed', 'svelte-toolbelt'] } },
  },
})
