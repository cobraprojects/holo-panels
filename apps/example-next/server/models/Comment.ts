import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('comments', {
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
  traits: [HasUlids()],
})
