import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const comments = defineGeneratedTable('comments', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string(),
  authorName: column.string(),
  body: column.string(),
  status: column.string(),
})

export default defineModel(comments, {
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
})
