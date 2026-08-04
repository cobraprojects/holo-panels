import { columnsFor, createExtensionTypeId } from '@holo-js/panels-core'
import { Product } from './model'

export const ratingColumnType = createExtensionTypeId('acme.catalog', 'column', 'rating')

export const ratingColumn = columnsFor(Product)
  .custom(ratingColumnType, 'rating', { maximum: 5 })
  .label('Rating')
  .sortable()
