import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const categories = defineGeneratedTable('categories', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  name: column.string(),
  slug: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(categories, {
  createdAtColumn: 'createdAt',
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
