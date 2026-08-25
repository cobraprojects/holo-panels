import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^@\//u, replacement: `${resolve(import.meta.dirname, 'src')}/` },
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
