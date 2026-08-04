import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const postTags = defineGeneratedTable('post_tags', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string(),
  tagId: column.string(),
})

export default defineModel(postTags, {
  fillable: ['postId', 'tagId'],
  guarded: ['id', 'tenantId'],
  traits: [HasUlids()],
  timestamps: true,
})
