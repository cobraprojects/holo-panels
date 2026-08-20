import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('tags', {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
  traits: [HasUlids()],
})
