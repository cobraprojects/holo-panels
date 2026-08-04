import { createPanelTransferTables } from '@holo-js/panels-core'

export const migrations = Object.freeze([
  createPanelTransferTables,
] as const)

export default migrations
