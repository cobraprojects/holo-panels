import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

export const postTags = defineGeneratedTable('post_tags', {
  id: column.string().primaryKey(),
  postId: column.string(),
  position: column.integer(),
  tagId: column.string(),
  tenantId: column.string(),
})

export default defineModel(postTags, {
  fillable: ['postId', 'position', 'tagId'],
  guarded: ['id', 'tenantId'],
  timestamps: false,
  traits: [HasUlids()],
})
