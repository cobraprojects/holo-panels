import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@holo-js/panels-core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        test: {
          environment: 'node',
          include: ['tests/p14-sveltekit-auth-route.test.ts', 'tests/server.test.ts'],
          name: 'server',
        },
      },
      {
        plugins: [svelte()],
        resolve: {
          alias: [
            { find: '@holo-js/panels-svelte/server', replacement: fileURLToPath(new URL('../svelte/src/server.ts', import.meta.url)) },
            { find: '@holo-js/panels-svelte', replacement: fileURLToPath(new URL('../svelte/src/index.ts', import.meta.url)) },
          ],
        },
        test: {
          environment: 'node',
          include: ['tests/p13-sveltekit-notification-endpoint.test.ts', 'tests/resource-page.test.ts'],
          name: 'renderer',
        },
      },
    ],
  },
})
