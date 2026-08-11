import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const tenants = defineGeneratedTable('tenants', {
  id: column.string().primaryKey(),
  name: column.string(),
  slug: column.string(),
})

export default defineModel(tenants, {
  fillable: ['name', 'slug'],
  guarded: ['id'],
  timestamps: false,
})
