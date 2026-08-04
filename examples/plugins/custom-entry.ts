import { createExtensionTypeId, entriesFor } from '@holo-js/panels-core'
import { Product } from './model'

export const ratingEntryType = createExtensionTypeId('acme.catalog', 'entry', 'rating')

export const ratingEntry = entriesFor(Product)
  .custom(ratingEntryType, 'rating', { maximum: 5 })
  .label('Rating')
