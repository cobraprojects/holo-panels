import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

export const postTags = defineGeneratedTable('post_tags', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string(),
  position: column.integer(),
  tagId: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(postTags, {
  createdAtColumn: 'createdAt',
  fillable: ['postId', 'position', 'tagId'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
  updatedAtColumn: 'updatedAt',
})
