import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const comments = defineGeneratedTable('comments', {
  id: column.string().primaryKey(),
  postId: column.string(),
  authorName: column.string(),
  body: column.text(),
  status: column.string(),
  tenantId: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(comments, {
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
})
