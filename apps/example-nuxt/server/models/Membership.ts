import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const memberships = defineGeneratedTable('memberships', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  userId: column.string(),
  roleKey: column.string(),
})

export default defineModel(memberships, {
  fillable: ['userId', 'roleKey'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
})
