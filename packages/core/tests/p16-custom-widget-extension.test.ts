import { describe, expect, expectTypeOf, it } from 'vitest'
import { createExtensionTypeId, defineCustomWidget, type CustomWidgetData, type WidgetBuilder } from '../src'
import { resolveWidget } from '../src/widgets/resolution'

describe('P16 custom widget extension IDs', () => {
  it('rejects source paths instead of serializing them as renderer identifiers', async () => {
    const widget = defineCustomWidget('summary').data(() => ({ component: '/private/server.ts', properties: {} })).compile()
    await expect(resolveWidget(widget, { actor: {}, locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: null })).rejects.toThrow('renderer identifier')
  })
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
