import { describe, expect, expectTypeOf, it } from 'vitest'
import { entriesFor } from '../src/infolists/entries'
import { defineSchema } from '../src/schemas/builder'
import { schemaComponentsFor } from '../src/schemas/layouts'
import { schemaEntry, schemaFilter, schemaWidget } from '../src/schemas/leaves'
import { filtersFor } from '../src/tables/filters'
import { defineStatsWidget } from '../src/widgets'

class Post {
  published = false
  title = ''
}

class PanelContext {
  locale = 'en'
}

class Actor {
  role = 'admin'
}

class Services {
  source = 'database'
}

describe('P16 shared schema leaves', () => {
  it('composes inferred entry, filter, and widget sources through one schema tree', () => {
    const entry = entriesFor(Post).text('title').markdown()
    const filter = filtersFor(Post, PanelContext).boolean('published', 'published').columnSpan(2)
    const widget = defineStatsWidget('overview', { actor: Actor, services: Services, tenant: String })
      .heading('Overview')
      .columnSpan('full')
      .sort(3)
      .data(context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.tenant).toEqualTypeOf<string>()
        expectTypeOf(context.services).toEqualTypeOf<Services>()
        return { stats: [] }
      })
    const components = schemaComponentsFor(Post, PanelContext)
    const schema = defineSchema('post-overview', Post, PanelContext)
      .components([
        components.section([
          components.entry(entry),
          components.filter(filter),
          components.widget(widget),
        ]),
      ])
      .compile()

    const leaves = schema.components[0]?.children ?? []
    expect(leaves.map(leaf => leaf.kind)).toEqual(['entry', 'filter', 'widget'])
    expect(leaves.map(leaf => leaf.properties.leaf?.kind)).toEqual(['entry', 'filter', 'widget'])
    expect(leaves[0]).toMatchObject({
      layout: {},
      statePath: 'title',
      type: 'text',
    })
    expect(leaves[1]).toMatchObject({
      layout: { columnSpan: { default: 2 } },
      statePath: 'published',
      type: 'boolean',
    })
    expect(leaves[2]).toMatchObject({
      layout: { columnSpan: { default: 'full' }, order: { default: 3 } },
      type: 'panels.widgets.stats',
    })
    expect(JSON.stringify(schema)).not.toContain('=>')

    expectTypeOf(components.entry(entry)).toMatchTypeOf<ReturnType<typeof components.entry>>()
    expectTypeOf(components.filter(filter)).toMatchTypeOf<ReturnType<typeof components.filter>>()
    expectTypeOf(components.widget(widget)).toMatchTypeOf<ReturnType<typeof components.widget>>()
  })

  it('provides standalone value-inferred leaf adapters for nested layouts', () => {
    const entry = schemaEntry(entriesFor(Post).text('title'))
    const filter = schemaFilter(filtersFor(Post, PanelContext).boolean('published', 'published'))
    const widget = schemaWidget(defineStatsWidget('overview', { actor: Actor, services: Services, tenant: String }).data(() => ({ stats: [] })))

    entry.visible(context => {
      expectTypeOf(context.record).toEqualTypeOf<Readonly<Post>>()
      expectTypeOf(context.value).toEqualTypeOf<string>()
      return true
    })
    filter.visible(context => {
      expectTypeOf(context).toEqualTypeOf<PanelContext>()
      return context.locale === 'en'
    })
    widget.visible(context => {
      expectTypeOf(context.actor).toEqualTypeOf<Actor>()
      expectTypeOf(context.tenant).toEqualTypeOf<string>()
      expectTypeOf(context.services).toEqualTypeOf<Services>()
      return true
    })

    expect(entry.kind).toBe('entry')
    expect(filter.kind).toBe('filter')
    expect(widget.kind).toBe('widget')
  })
})
