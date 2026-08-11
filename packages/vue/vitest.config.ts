import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      { find: /^vue\/(.+)$/u, replacement: `${resolve(import.meta.dirname, '../../node_modules/vue')}/$1` },
      { find: 'vue', replacement: resolve(import.meta.dirname, '../../node_modules/vue') },
    ],
    dedupe: ['vue'],
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
})
