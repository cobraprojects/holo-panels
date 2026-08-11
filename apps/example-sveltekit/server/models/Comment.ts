import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const comments = defineGeneratedTable('comments', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  postId: column.string().nullable(),
  authorName: column.string(),
  body: column.string(),
  status: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(comments, {
  createdAtColumn: 'createdAt',
  fillable: ['postId', 'authorName', 'body', 'status'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
  updatedAtColumn: 'updatedAt',
})
