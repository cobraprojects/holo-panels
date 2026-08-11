import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const comments = defineGeneratedTable('comments', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string().nullable(),
  authorName: column.string(),
  body: column.string(),
  status: column.string(),
})

export default defineModel(comments, {
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
})
