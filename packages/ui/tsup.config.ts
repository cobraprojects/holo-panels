import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/style.css'],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
