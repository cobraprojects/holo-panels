import PostExporter from '../server/admin/exports/PostExporter'
import PostImporter from '../server/admin/imports/PostImporter'

export const svelteKitTransferAcceptanceFixture = Object.freeze({
  exporterId: PostExporter.id,
  framework: 'sveltekit',
  importerId: PostImporter.id,
})
