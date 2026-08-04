import { createExtensionTypeId, defineCustomWidget } from '@holo-js/panels-core'

export const ratingWidgetType = createExtensionTypeId('acme.catalog', 'widget', 'rating-summary')

export const ratingWidget = defineCustomWidget('rating-summary', ratingWidgetType)
  .heading('Rating summary')
  .data(() => ({
    component: 'acme.catalog.rating-summary',
    properties: { maximum: 5 },
  }))
