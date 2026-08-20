import { defineModel } from '@holo-js/db'

export default defineModel('media', {
  createdAtColumn: 'createdAt',
  fillable: ['alt'],
  guarded: ['id', 'tenantId', 'disk', 'path', 'mime', 'size'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
