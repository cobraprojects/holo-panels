import { createExtensionTypeId, extensionFiltersFor } from '@holo-js/panels-core'

export const ratingFilterType = createExtensionTypeId('acme.catalog', 'filter', 'minimum-rating')

export const ratingFilter = extensionFiltersFor().create('minimum-rating', ratingFilterType, {
  defaultValue: Number(0),
  encode: value => value === 0
    ? null
    : { id: 'minimum_rating', operator: '>=', value },
  properties: { maximum: 5, minimum: 0, step: 0.5 },
  targets: {
    minimum_rating: { column: 'products.rating', operators: ['>='] },
  },
}).label('Minimum rating')
