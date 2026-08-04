import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts', 'src/server.ts'],
  external: ['@holo-js/panels-next/client'],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
