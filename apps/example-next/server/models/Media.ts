import { column, defineGeneratedTable, defineModel } from '@holo-js/db'

const media = defineGeneratedTable('media', {
  id: column.string().primaryKey(),
  tenantId: column.string(),
  disk: column.string(),
  path: column.string(),
  mime: column.string(),
  size: column.integer(),
  alt: column.string(),
  createdAt: column.timestamp(),
  updatedAt: column.timestamp(),
})

export default defineModel(media, {
  fillable: ['disk', 'path', 'mime', 'size', 'alt'],
  guarded: ['id', 'tenantId', 'createdAt', 'updatedAt'],
  hidden: ['disk', 'path'],
  timestamps: false,
})
