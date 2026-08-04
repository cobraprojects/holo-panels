import { defineHoloPlugin } from '@holo-js/kernel'

export const plugin = defineHoloPlugin({
  id: 'panels-shield',
  name: 'Holo Panels Shield',
  description: 'Role and permission management for Holo Panels',
  contributes: {
    cli: { commands: './dist/holo-commands.mjs' },
    migrations: { publish: './dist/migrations.mjs' },
  },
} as const)

export default plugin
