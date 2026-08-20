import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('post_tags', {
  createdAtColumn: 'createdAt',
  fillable: ['postId', 'position', 'tagId'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
  updatedAtColumn: 'updatedAt',
})
