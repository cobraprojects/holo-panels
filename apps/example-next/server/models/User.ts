import { belongsToMany, defineModel } from '@holo-js/db'
import Tenant from './Tenant'

export default defineModel('users', {
  fillable: ['name', 'email', 'password', 'role', 'tenantId'],
  guarded: ['id', 'createdAt', 'updatedAt'],
  hidden: ['password'],
  relations: {
    tenants: belongsToMany(() => Tenant, 'memberships', 'userId', 'tenantId'),
  },
  timestamps: false,
})
