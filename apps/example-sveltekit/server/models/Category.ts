import { defineModel } from '@holo-js/db'

export default defineModel('categories', {
  createdAtColumn: 'createdAt',
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
