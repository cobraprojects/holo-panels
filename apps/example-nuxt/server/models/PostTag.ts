import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

export const postTags = defineGeneratedTable('post_tags', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string(),
  position: column.integer(),
  tagId: column.string(),
})

export default defineModel(postTags, {
  fillable: ['postId', 'position', 'tagId'],
  guarded: ['id', 'tenantId'],
  traits: [HasUlids()],
  timestamps: true,
})
