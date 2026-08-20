import { defineModel } from '@holo-js/db'

export default defineModel('categories', {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
})
