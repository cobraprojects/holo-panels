import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { field, schema } from '@holo-js/forms'
import { createViewAction } from '../src/actions/builtins'
import { applyComponentDefaults, withComponentDefaults } from '../src/defaults/apply-defaults'
import { componentDefault, definePanelsConfig } from '../src/defaults/component-default'
import { fields } from '../src/fields/basic/factory'
import { entriesFor } from '../src/infolists/entries/builtins'
import { defineSchema } from '../src/schemas/builder'
import { section } from '../src/schemas/layouts'
import { columnsFor, type TextColumn } from '../src/tables/columns/builtins'
import { filtersFor } from '../src/tables/filters/builtins'
import { summariesFor } from '../src/tables/grouping/summaries'
import { defineStatsWidget } from '../src/widgets/builder'

class Post {
  readonly published = false
  readonly title = ''
  readonly total = 0
}

describe('P16 component defaults', () => {
  it('applies matching defaults in application, plugin registration, and panel order before local calls', () => {
    const application = componentDefault('column', 'text', builder => builder.label('Application'))
    const firstPlugin = componentDefault('column', 'text', builder => builder.label('First plugin'))
    const secondPlugin = componentDefault('column', 'text', builder => builder.label('Second plugin'))
    const panel = componentDefault('column', 'text', builder => builder.label('Panel'))
    const ignored = componentDefault('column', 'boolean', builder => builder.label('Ignored'))
    const builder = applyComponentDefaults({
      application: definePanelsConfig({ defaults: [application, ignored] }).defaults,
      builder: columnsFor(Post).text('title'),
      kind: 'column',
      panel: [panel],
      plugins: [[firstPlugin], [secondPlugin]],
      type: 'text',
    })

    expectTypeOf(builder).toEqualTypeOf<TextColumn<Post, 'title'>>()
    expect(builder.label('Local').compile().manifest.label).toBe('Local')

    const withoutLocalOverride = applyComponentDefaults({
      application: [application],
      builder: columnsFor(Post).text('title'),
      kind: 'column',
      panel: [panel],
      plugins: [[firstPlugin], [secondPlugin]],
      type: 'text',
    })
    expect(withoutLocalOverride.compile().manifest.label).toBe('Panel')
  })

  it('applies each builder once and rejects application after compilation', () => {
    const apply = vi.fn()
    const value = componentDefault('column', 'text', builder => {
      apply()
      return builder.label('Default')
    })
    const builder = columnsFor(Post).text('title')

    applyComponentDefaults({ application: [value], builder, kind: 'column', type: 'text' })
    expect(() => applyComponentDefaults({ application: [value], builder, kind: 'column', type: 'text' })).toThrow('only be applied once')
    expect(apply).toHaveBeenCalledTimes(1)

    const compiledBuilder = columnsFor(Post).text('title')
    compiledBuilder.compile()
    expect(() => applyComponentDefaults({
      application: [value],
      builder: compiledBuilder,
      compiled: true,
      kind: 'column',
      type: 'text',
    })).toThrow('after compilation')
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('preserves subtype identity across every layer', () => {
    class InvalidBuilder {}
    const invalid = componentDefault<object>('column', 'text', () => new InvalidBuilder())
    const builder = columnsFor(Post).text('title')

    expect(() => applyComponentDefaults({ application: [invalid], builder, kind: 'column', type: 'text' })).toThrow('same concrete builder subtype')
  })

  it('automatically captures ordered layers and applies them once before local fluent calls', async () => {
    const applied: string[] = []
    const value = (layer: string) => componentDefault('column', 'text', (builder) => {
      applied.push(layer)
      return builder.label(layer)
    })

    await withComponentDefaults({
      application: [value('application')],
      plugins: [[value('first-plugin')], [value('second-plugin')]],
      panel: [value('panel')],
    }, async () => {
      const local = columnsFor(Post).text('title').label('local')
      expectTypeOf(local).toEqualTypeOf<TextColumn<Post, 'title'>>()
      expect(local.compile().manifest.label).toBe('local')
      expect(local.compile().manifest.label).toBe('local')

      const inherited = columnsFor(Post).text('title')
      expect(inherited.compile().manifest.label).toBe('panel')
    })

    expect(applied).toEqual([
      'application', 'first-plugin', 'second-plugin', 'panel',
      'application', 'first-plugin', 'second-plugin', 'panel',
    ])
  })

  it('automatically applies defaults across fluent component families', async () => {
    const form = schema({ title: field.string() })
    await withComponentDefaults({ application: [
      componentDefault('action', 'view', builder => builder.label('Action')),
      componentDefault('field', 'text', builder => builder.label('Field')),
      componentDefault('entry', 'text', builder => builder.label('Entry')),
      componentDefault('filter', 'ternary', builder => builder.label('Filter')),
      componentDefault('summary', 'sum', builder => builder.label('Summary')),
      componentDefault('schema-component', 'section', builder => builder.hidden()),
      componentDefault('widget', 'panels.widgets.stats', builder => builder.heading('Widget')),
    ] }, async () => {
      expect(createViewAction({ authorize: () => true }).label).toBe('Action')
      expect(createViewAction({ authorize: () => true, label: 'Local action' }).label).toBe('Local action')
      expect(fields(form).text('title').compile().label).toBe('Field')
      expect(entriesFor(Post).text('title').compile().manifest.label).toBe('Entry')
      expect(filtersFor(Post).ternary('published', 'published').compile().manifest.label).toBe('Filter')
      expect(summariesFor(Post).sum('total', 'total').compile().manifest.label).toBe('Summary')
      expect(defineSchema('post').components([section()]).compile().components[0]?.visible).toBe(false)
      expect(defineStatsWidget('stats').compile().manifest.heading).toBe('Widget')
    })
  })
})
