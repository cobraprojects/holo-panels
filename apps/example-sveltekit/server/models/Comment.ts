import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('comments', {
  createdAtColumn: 'createdAt',
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
  updatedAtColumn: 'updatedAt',
})
