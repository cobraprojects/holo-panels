import { defineModel, HasUlids } from '@holo-js/db'

export default defineModel('post_tags', {
  fillable: ['postId', 'position', 'tagId'],
  guarded: ['id', 'tenantId'],
  timestamps: false,
  traits: [HasUlids()],
})
