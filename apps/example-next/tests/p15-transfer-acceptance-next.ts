import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

export const nextTransferAcceptanceFixture = Object.freeze({
  exporterId: PostExporter.id,
  framework: 'next',
  importerId: PostImporter.id,
})
