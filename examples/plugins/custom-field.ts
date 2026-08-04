import { createExtensionTypeId, fields } from '@holo-js/panels-core'
import { productForm } from './model'

export const ratingFieldType = createExtensionTypeId('acme.catalog', 'field', 'rating')

export const ratingField = fields(productForm)
  .custom('rating', ratingFieldType, {
    codec: {
      decode(value) {
        if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError('Ratings must be finite numbers')
        return value
      },
      encode(value) {
        if (!Number.isFinite(value)) throw new TypeError('Ratings must be finite numbers')
        return value
      },
    },
    properties: { maximum: 5, minimum: 0, step: 0.5 },
    validate(value) {
      if (value < 0 || value > 5) throw new RangeError('Ratings must be between zero and five')
    },
  })
  .label('Rating')
