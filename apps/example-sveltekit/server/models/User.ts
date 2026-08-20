import { belongsToMany, defineModel } from '@holo-js/db'
import Tenant from './Tenant'

export default defineModel('users', {
  createdAtColumn: 'createdAt',
  fillable: ['name', 'email', 'password', 'roleKey', 'tenantId'],
  guarded: ['id'],
  hidden: ['password'],
  relations: {
    tenants: belongsToMany(() => Tenant, 'memberships', 'userId', 'tenantId'),
  },
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
