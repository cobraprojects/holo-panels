import { defineModel } from '@holo-js/db'

export default defineModel('media', {
  fillable: ['disk', 'path', 'mime', 'size', 'alt'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  hidden: ['disk', 'path'],
  timestamps: false,
})
