import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  resolve: {
    alias: [
      { find: '@holo-js/panels/plugin', replacement: `${workspaceRoot}/packages/panels/src/plugin.ts` },
      { find: '@holo-js/panels-core', replacement: `${workspaceRoot}/packages/core/src/index.ts` },
      { find: '@holo-js/forms', replacement: `${workspaceRoot}/packages/panels/node_modules/@holo-js/forms/dist/index.mjs` },
    ],
  },
  test: {
    include: [`${workspaceRoot}/examples/plugins/**/*.test.ts`],
  },
})
