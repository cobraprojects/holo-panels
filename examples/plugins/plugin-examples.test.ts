import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  catalogPlugin,
  featureAction,
  insightsPage,
  ratingColumn,
  ratingEntry,
  ratingField,
  ratingFilter,
  ratingWidget,
} from './index'
import {
  FeatureAction,
  InsightsPage,
  RatingColumn,
  RatingEntry,
  RatingField,
  RatingFilter,
  RatingWidget,
} from './renderers'

describe('P16 public plugin examples', () => {
  it('preserves model paths and extension IDs without manual generic arguments', async () => {
    const field = ratingField.compile()
    const column = ratingColumn.compile()
    const entry = ratingEntry.compile()
    const filter = ratingFilter.compile()

    expectTypeOf(field.path).toEqualTypeOf<'rating'>()
    expectTypeOf(column.manifest.path).toEqualTypeOf<'rating'>()
    expect(entry.manifest.path).toBe('rating')
    expect(field.type).toBe('acme.catalog:field:rating')
    expect(column.manifest.type).toBe('acme.catalog:column:rating')
    expect(entry.manifest.type).toBe('acme.catalog:entry:rating')
    expect(filter.manifest.type).toBe('acme.catalog:filter:minimum-rating')
    await expect(Promise.resolve(filter.server.encode(4, { context: undefined }))).resolves.toEqual({
      id: 'minimum_rating',
      operator: '>=',
      value: 4,
    })
  })

  it('uses renderer-backed action, widget, and page extension types', () => {
    expect(featureAction.type).toBe('acme.catalog:action:feature')
    expect(ratingWidget.compile().manifest.type).toBe('acme.catalog:widget:rating-summary')
    expect(insightsPage.compile().manifest.renderer?.type).toBe('acme.catalog:page:insights')
  })

  it('collects the complete plugin through the public plugin subpath', () => {
    const installation = catalogPlugin.install({ guard: 'web', id: 'admin' })
    const kinds = installation.contributions.map(contribution => contribution.kind)

    expect(kinds.filter(kind => kind === 'extension')).toHaveLength(7)
    expect(kinds.filter(kind => kind === 'renderer')).toHaveLength(7)
    expect(kinds).toEqual(expect.arrayContaining(['page', 'widget', 'translation', 'asset']))
  })

  it('ships functional renderer exports with concrete inferred properties', () => {
    expect(RatingField({ value: 4.5 })).toBe('Rating: 4.5 / 5')
    expect(RatingColumn({ label: 'Score', maximum: 10, value: 8 })).toBe('Score: 8.0 / 10')
    expect(RatingEntry({ value: 3 })).toBe('Rating: 3.0 / 5')
    expect(RatingFilter({ value: 2.5 })).toBe('Minimum rating: 2.5 / 5')
    expect(FeatureAction({ pending: true })).toBe('Featuring…')
    expect(RatingWidget({ average: 4.25, count: 12 })).toBe('Average rating: 4.3 / 5 from 12 reviews')
    expect(InsightsPage({ featured: 12, reviewed: 48 })).toBe('Product insights: 12 featured, 48 reviewed')
  })
})
