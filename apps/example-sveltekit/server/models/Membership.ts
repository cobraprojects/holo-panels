import { defineModel } from '@holo-js/db'

export default defineModel('memberships', {
  createdAtColumn: 'createdAt',
  fillable: ['userId', 'roleKey'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
