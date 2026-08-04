import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/plugin.ts',
    'src/commands.ts',
    'src/runtime.ts',
    'src/migrations.ts',
    'src/prepare.ts',
    'src/server.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  outExtension: () => ({ js: '.mjs' }),
})
