import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const categories = defineGeneratedTable('categories', {
  id: column.string().primaryKey(),
  name: column.string(),
  slug: column.string(),
  tenantId: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(categories, {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
})
