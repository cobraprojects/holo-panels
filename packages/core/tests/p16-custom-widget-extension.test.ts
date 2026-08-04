import { describe, expect, expectTypeOf, it } from 'vitest'
import { createExtensionTypeId, defineCustomWidget, type CustomWidgetData, type WidgetBuilder } from '../src'

describe('P16 custom widget extension IDs', () => {
  it('accepts an inferred widget extension type without manual generic arguments', () => {
    const typeId = createExtensionTypeId('acme.catalog', 'widget', 'rating-summary')
    const widget = defineCustomWidget('rating-summary', typeId)
      .data(() => ({ component: 'acme.catalog.rating-summary', properties: { minimum: 4 } }))

    expectTypeOf(widget).toEqualTypeOf<WidgetBuilder<CustomWidgetData>>()
    expect(widget.compile().manifest.type).toBe('acme.catalog:widget:rating-summary')
  })

  it('retains the built-in custom widget type and rejects other colon IDs', () => {
    expect(defineCustomWidget('summary').compile().manifest.type).toBe('panels.widgets.custom')
    expect(() => defineCustomWidget('summary', 'acme.catalog:field:rating' as never)).toThrow('widget extension type ID')
  })
})
