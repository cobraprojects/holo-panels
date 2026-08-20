import { defineModel } from '@holo-js/db'

export default defineModel('memberships', {
  fillable: ['userId', 'roleKey'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
})
