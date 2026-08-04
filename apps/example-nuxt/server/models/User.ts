import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const users = defineGeneratedTable('users', {
  id: column.string().primaryKey(),
  name: column.string(),
  email: column.string().unique(),
  password: column.string(),
  role: column.string(),
  tenantId: column.string().nullable(),
})

export default defineModel(users, {
  fillable: ['name', 'email', 'password', 'role', 'tenantId'],
  guarded: ['id'],
  hidden: ['password'],
  timestamps: true,
})
