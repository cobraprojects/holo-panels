import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

function rendererResolution() {
  return {
    alias: [
      { find: /^@\//u, replacement: `${resolve(import.meta.dirname, '../vue/src')}/` },
      { find: /^react$/u, replacement: resolve(import.meta.dirname, '../../node_modules/react/index.js') },
      { find: /^react-dom$/u, replacement: resolve(import.meta.dirname, '../../node_modules/react-dom/index.js') },
      { find: /^react-dom\/(.*)$/u, replacement: resolve(import.meta.dirname, '../../node_modules/react-dom/$1') },
      { find: /^svelte\/internal\/client$/u, replacement: resolve(import.meta.dirname, '../../node_modules/svelte/src/internal/client/index.js') },
      { find: /^svelte$/u, replacement: resolve(import.meta.dirname, '../../node_modules/svelte/src/index-client.js') },
      { find: /^vue\/(.+)$/u, replacement: `${resolve(import.meta.dirname, '../../node_modules/vue')}/$1` },
      { find: 'vue', replacement: resolve(import.meta.dirname, '../../node_modules/vue') },
    ],
    dedupe: ['react', 'react-dom', 'svelte', 'vue'],
  }
}

export default defineConfig({
  optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  plugins: [svelte(), vue()],
  resolve: rendererResolution(),
  ssr: {
    noExternal: ['bits-ui', 'runed', 'svelte-toolbelt'],
    optimizeDeps: { exclude: ['bits-ui', 'runed', 'svelte', 'svelte-toolbelt'] },
  },
  test: {
    projects: [
      {
        test: {
          environment: 'node',
          fileParallelism: false,
          include: [
            'tests/contracts.test.ts',
            'tests/p12-table-widget-runtime.test.ts',
            'tests/p9-example-phase-gate.test.ts',
            'tests/p13-holo-notification-runtime.test.ts',
            'tests/p13-sqlite-notification-phase-gate.test.ts',
            'tests/p15-transfer-phase-gate.test.ts',
          ],
          name: 'server',
          sequence: { groupOrder: 1 },
        },
      },
      {
        plugins: [svelte(), vue()],
        resolve: rendererResolution(),
        test: {
          environment: 'happy-dom',
          include: [
            'tests/p5-renderer-parity.test.ts',
            'tests/p6-form-acceptance.test.ts',
            'tests/p7-table-acceptance.test.ts',
            'tests/p8-infolist-action-acceptance.test.ts',
            'tests/p10-relation-manager-acceptance.test.ts',
            'tests/p11-navigation-search-acceptance.test.ts',
            'tests/p12-widget-acceptance.test.ts',
            'tests/p13-notification-acceptance.test.ts',
            'tests/p14-shield-resource-ui.test.ts',
          ],
          hookTimeout: 30_000,
          name: 'renderer',
          server: { deps: { inline: ['bits-ui', 'runed', 'svelte-toolbelt'] } },
          testTimeout: 30_000,
        },
      },
    ],
  },
})
