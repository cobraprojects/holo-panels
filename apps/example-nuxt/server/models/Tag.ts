import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('tags', {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
})
