import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const users = defineGeneratedTable('users', {
  id: column.string().primaryKey(),
  name: column.string(),
  email: column.string().unique(),
  password: column.string(),
  roleKey: column.string(),
  tenantId: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(users, {
  createdAtColumn: 'createdAt',
  fillable: ['name', 'email', 'password', 'roleKey', 'tenantId'],
  guarded: ['id'],
  hidden: ['password'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
