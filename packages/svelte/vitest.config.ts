import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  plugins: [svelte()],
  resolve: {
    conditions: ['browser'],
    dedupe: ['svelte'],
  },
  ssr: {
    noExternal: ['bits-ui', 'runed', 'svelte-toolbelt'],
    optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  },
  test: {
    environment: 'happy-dom',
    hookTimeout: 30_000,
    include: ['tests/**/*.test.ts'],
    maxWorkers: 2,
    server: { deps: { inline: ['bits-ui', 'runed', 'svelte-toolbelt'] } },
  },
})
