import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/react.tsx', 'src/vue.ts', 'src/svelte.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
