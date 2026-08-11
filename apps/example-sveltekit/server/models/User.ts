import { belongsToMany, column, defineGeneratedTable, defineModel } from '@holo-js/db'
import { memberships } from './Membership'
import Tenant from './Tenant'

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
  relations: {
    tenants: belongsToMany(() => Tenant, memberships, 'userId', 'tenantId'),
  },
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
