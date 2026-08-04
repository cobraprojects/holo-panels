import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/server.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    outExtension: () => ({ js: '.mjs' }),
  },
  {
    entry: ['src/style.css'],
    format: ['esm'],
    dts: false,
    clean: false,
  },
])
