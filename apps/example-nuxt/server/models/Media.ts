import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const media = defineGeneratedTable('media', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  disk: column.string(),
  path: column.string(),
  mime: column.string(),
  size: column.integer(),
  alt: column.string(),
})

export default defineModel(media, {
  fillable: ['alt'],
  guarded: ['id', 'tenantId', 'disk', 'path', 'mime', 'size'],
  timestamps: true,
})
