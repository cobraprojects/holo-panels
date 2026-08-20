import { defineModel } from '@holo-js/db'

export default defineModel('media', {
  fillable: ['alt'],
  guarded: ['id', 'tenantId', 'disk', 'path', 'mime', 'size'],
  timestamps: true,
})
