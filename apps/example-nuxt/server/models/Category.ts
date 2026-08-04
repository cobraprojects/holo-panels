import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const categories = defineGeneratedTable('categories', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  name: column.string(),
  slug: column.string(),
})

export default defineModel(categories, {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
})
