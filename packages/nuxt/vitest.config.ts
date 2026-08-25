import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { resolve as resolvePath } from 'node:path'

const vuePath = resolvePath(import.meta.dirname, '../../node_modules/vue')
const aliases = [
  { find: '#imports', replacement: fileURLToPath(new URL('./tests/nuxt-imports.ts', import.meta.url)) },
  { find: /^vue\/(.+)$/u, replacement: `${vuePath}/$1` },
  { find: 'vue', replacement: vuePath },
]

export default defineConfig({
  resolve: {
    alias: aliases,
    dedupe: ['vue', '@vue/runtime-core'],
  },
  ssr: { noExternal: ['reka-ui'] },
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
          alias: aliases,
          dedupe: ['vue', '@vue/runtime-core'],
        },
        ssr: { noExternal: ['reka-ui'] },
        test: {
          environment: 'happy-dom',
          include: [
            'tests/auth-pages.test.ts',
            'tests/p13-nuxt-notification-endpoint.test.ts',
            'tests/p13-nuxt-notifications.test.ts',
            'tests/p13-nuxt-session-effects.test.ts',
            'tests/login-page.test.ts',
            'tests/p9-d-nuxt-adapter.test.ts',
          ],
          name: 'renderer',
        },
      },
    ],
  },
})
