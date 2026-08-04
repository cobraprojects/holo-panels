import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/holo-plugin.ts',
    'src/holo-commands.ts',
    'src/migrations.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
