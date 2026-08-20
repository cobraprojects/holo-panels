import { defineModel } from '@holo-js/db'

export default defineModel('tenants', {
  fillable: ['name', 'slug'],
  guarded: ['id'],
  timestamps: false,
})
