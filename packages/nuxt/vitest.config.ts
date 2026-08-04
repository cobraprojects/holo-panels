import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '#imports': fileURLToPath(new URL('./tests/nuxt-imports.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        test: {
          environment: 'node',
          include: ['tests/p14-nuxt-auth-route.test.ts'],
          name: 'server',
        },
      },
      {
        resolve: {
          alias: {
            '#imports': fileURLToPath(new URL('./tests/nuxt-imports.ts', import.meta.url)),
          },
        },
        test: {
          environment: 'happy-dom',
          include: [
            'tests/p13-nuxt-notification-endpoint.test.ts',
            'tests/p13-nuxt-notifications.test.ts',
            'tests/p13-nuxt-session-effects.test.ts',
            'tests/p9-d-nuxt-adapter.test.ts',
          ],
          name: 'renderer',
        },
      },
    ],
  },
})
