import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const users = defineGeneratedTable('users', {
  id: column.string().primaryKey(),
  name: column.string(),
  email: column.string(),
  password: column.string(),
  role: column.string(),
  tenantId: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(users, {
  fillable: ['name', 'email', 'password', 'role', 'tenantId'],
  guarded: ['id', 'createdAt', 'updatedAt'],
  hidden: ['password'],
  timestamps: false,
})
