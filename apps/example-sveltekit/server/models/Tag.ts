import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const tags = defineGeneratedTable('tags', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  name: column.string(),
  slug: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(tags, {
  createdAtColumn: 'createdAt',
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
