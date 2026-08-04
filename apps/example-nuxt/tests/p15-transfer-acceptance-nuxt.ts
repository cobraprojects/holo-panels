import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

export const nuxtTransferAcceptanceFixture = Object.freeze({
  exporterId: PostExporter.id,
  framework: 'nuxt',
  importerId: PostImporter.id,
})
