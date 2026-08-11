import { column, defineGeneratedTable, defineModel, HasUlids } from '@holo-js/db'

const tags = defineGeneratedTable('tags', {
  id: column.string().primaryKey(),
  name: column.string(),
  slug: column.string(),
  tenantId: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(tags, {
  fillable: ['name', 'slug'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  timestamps: false,
  traits: [HasUlids()],
})
