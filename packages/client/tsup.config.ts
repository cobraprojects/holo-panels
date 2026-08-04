import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/browser.ts', 'src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
