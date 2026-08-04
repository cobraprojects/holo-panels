import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const postTags = defineGeneratedTable('post_tags', {
  id: column.string().primaryKey(),
  postId: column.string(),
  tagId: column.string(),
  tenantId: column.string(),
})

export default defineModel(postTags, {
  fillable: ['postId', 'tagId'],
  guarded: ['id', 'tenantId'],
  timestamps: false,
  traits: [HasUlids()],
})
