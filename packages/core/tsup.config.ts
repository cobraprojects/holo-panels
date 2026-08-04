import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/browser.ts', 'src/server.ts', 'src/transfers.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
