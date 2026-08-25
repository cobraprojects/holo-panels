import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: ['src/style.css'],
    format: ['esm'],
    dts: false,
    clean: false,
  },
])
