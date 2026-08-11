import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const tags = defineGeneratedTable('tags', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  name: column.string(),
  slug: column.string(),
})

export default defineModel(tags, {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId'],
  timestamps: true,
  traits: [HasUlids()],
})
