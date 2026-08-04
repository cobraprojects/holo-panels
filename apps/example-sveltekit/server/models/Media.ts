import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const media = defineGeneratedTable('media', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  disk: column.string(),
  path: column.string(),
  mime: column.string(),
  size: column.integer(),
  alt: column.string(),
  createdAt: column.datetime(),
  updatedAt: column.datetime(),
})

export default defineModel(media, {
  createdAtColumn: 'createdAt',
  fillable: ['alt'],
  guarded: ['id', 'tenantId', 'disk', 'path', 'mime', 'size'],
  timestamps: true,
  updatedAtColumn: 'updatedAt',
})
