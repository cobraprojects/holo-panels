import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  dts: true,
  entry: ['index.ts', 'renderers.ts'],
  format: ['esm'],
  outExtension: () => ({ js: '.mjs' }),
})
