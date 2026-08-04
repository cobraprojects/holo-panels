import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const memberships = defineGeneratedTable('memberships', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  userId: column.string(),
  roleKey: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(memberships, {
  createdAtColumn: 'createdAt',
  fillable: ['userId', 'roleKey'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
