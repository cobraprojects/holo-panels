import type { MigrationDefinition } from '@holo-js/db'
import { createPanelShieldTables } from './database/migration'

export const migrations = Object.freeze([
  createPanelShieldTables,
] satisfies readonly MigrationDefinition[])

export default migrations
