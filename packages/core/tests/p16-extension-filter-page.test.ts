import { describe, expect, expectTypeOf, it } from 'vitest'
import { defineCustomPage } from '../src/pages/page'
import { createExtensionTypeId } from '../src/plugins/type-id'
import type { JsonObject } from '../src/protocol/json'
import {
  extensionFiltersFor,
  type ExtensionFilterBuilder,
} from '../src/tables/filters'

const extensionFilters = extensionFiltersFor()

describe('P16 registry-backed filters and pages', () => {
  it('infers extension filter value and type IDs from supplied values', async () => {
    const typeId = createExtensionTypeId('acme.analytics', 'filter', 'minimum-score')
    const filter = extensionFilters.create('minimum-score', typeId, {
      defaultValue: Number(0),
      encode: value => value === 0 ? null : { id: 'minimum_score', operator: '>=', value },
      properties: { suffix: '%' },
      targets: { minimum_score: { column: 'score', operators: ['>='] } },
    })
    const definition = filter.compile()

    const inferredFilter: ExtensionFilterBuilder<number, typeof typeId, unknown> = filter
    expectTypeOf(inferredFilter).toMatchTypeOf(filter)
    expect(definition.manifest).toMatchObject({
      defaultValue: 0,
      properties: { suffix: '%' },
      type: 'acme.analytics:filter:minimum-score',
    })
    await expect(Promise.resolve(definition.server.encode(75, { context: undefined }))).resolves.toEqual({
      id: 'minimum_score',
      operator: '>=',
      value: 75,
    })
    expect(JSON.stringify(definition.manifest)).not.toContain('encode')
  })

  it('rejects unsafe extension filter declarations', () => {
    const typeId = createExtensionTypeId('acme.analytics', 'filter', 'minimum-score')
    expect(() => extensionFilters.create('minimum-score', typeId, {
      defaultValue: 0,
      encode: () => null,
      targets: { unsafe: { column: 'score;drop', operators: ['>='] } },
    })).toThrow('Invalid extension filter column')
    expect(() => extensionFilters.create('minimum-score', typeId, {
      defaultValue: 0,
      encode: () => null,
      properties: { unsafe: () => undefined } as unknown as JsonObject,
      targets: { minimum_score: { column: 'score', operators: ['>='] } },
    })).toThrow('JSON-safe')
  })

  it('selects a page extension renderer without manual type arguments', () => {
    const typeId = createExtensionTypeId('acme.reports', 'page', 'overview')
    const page = defineCustomPage('reports')
      .renderer(typeId, { density: 'compact' })
      .compile()

    expect(page.manifest.renderer).toEqual({
      properties: { density: 'compact' },
      type: 'acme.reports:page:overview',
    })
    expect(defineCustomPage('reports').compile().manifest.renderer).toBeNull()
    expect(defineCustomPage('reports').renderer(typeId).compileDiscoveryDefinition().componentKeys).toEqual([typeId])
  })

  it('rejects non-JSON page renderer properties', () => {
    const typeId = createExtensionTypeId('acme.reports', 'page', 'overview')
    expect(() => defineCustomPage('reports').renderer(typeId, { unsafe: () => undefined } as unknown as JsonObject)).toThrow('JSON-safe')
  })
})
