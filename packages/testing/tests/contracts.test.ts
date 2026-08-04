import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  assertCommonCapabilities,
  assertDefinitionKind,
  assertEntryPresentation,
  assertManifestSafe,
  assertRendererAvailable,
  assertSchemaComponent,
  schemaComponent,
  schemaComponents,
  stateRoundTrip,
} from '../src/index'
import { PROTOCOL_VERSION, type PublicNode } from '@holo-js/panels-core'
import { EntryStateStore, type SchemaManifest } from '@holo-js/panels-client'

describe('definition contract helpers', () => {
  it('narrows definition kinds and preserves custom state types', () => {
    const node: PublicNode = {
      id: 'name',
      kind: 'field',
      properties: { path: 'name' },
      protocolVersion: PROTOCOL_VERSION,
      type: 'acme:field:name',
    }
    assertDefinitionKind(node, 'field')
    expectTypeOf(node.properties.path).toEqualTypeOf<string>()

    const state = stateRoundTrip({ currency: 'USD' as const, precision: 2 })
    expectTypeOf(state).toEqualTypeOf<{ currency: 'USD'; precision: number }>()
    expect(state).toEqual({ currency: 'USD', precision: 2 })
  })

  it('asserts common capabilities and manifest safety', () => {
    expect(() => assertCommonCapabilities({ label: 'Name' }, ['label'])).not.toThrow()
    const partial: { hidden?: boolean; label?: string } = { label: 'Name' }
    expect(() => assertCommonCapabilities(partial, ['hidden'])).toThrow(
      /missing capability hidden/,
    )
    expect(() => assertManifestSafe({ callback: () => true })).toThrow(/not JSON-safe/)
  })

  it('asserts renderer availability through the registry contract', () => {
    const registry = {
      hasRenderer: (typeId: string, panelId?: string) => (
        typeId === 'acme:field:money' && panelId === 'admin'
      ),
    }

    expect(() => assertRendererAvailable(registry, 'acme:field:money', 'admin')).not.toThrow()
    expect(() => assertRendererAvailable(registry, 'acme:field:money')).toThrow(
      /Expected renderer acme:field:money to be available/,
    )
  })

  it('inspects schema composition and entry presentation without framework types', () => {
    const child = {
      children: [],
      dynamicVisibility: false,
      extraAttributes: { 'data-kind': 'summary' },
      id: 'summary.title',
      key: 'summary-title',
      kind: 'custom',
      layout: { columnSpan: { default: 2 } },
      properties: { customType: 'acme:schema:summary' },
      slots: {},
      statePath: 'title',
      type: 'acme:schema:summary',
      visible: true,
    } as const
    const schema: SchemaManifest<{ readonly title: string }> = {
      components: [{ ...child, children: [child], id: 'summary', key: 'summary', statePath: undefined }],
      id: 'post-summary',
      kind: 'schema',
    }

    expect(schemaComponents(schema)).toHaveLength(2)
    expect(schemaComponent(schema, 'summary.title')).toBe(child)
    expect(assertSchemaComponent(schema, 'summary.title', {
      extraAttributes: { 'data-kind': 'summary' },
      kind: 'custom',
      statePath: 'title',
      visible: true,
    })).toBe(child)
    expect(() => schemaComponent(schema, 'missing')).toThrow('was not found')

    const entry = new EntryStateStore('summary-title', {
      actions: [],
      copyable: false,
      defaultValue: 'Post',
      extraAttributes: { 'data-kind': 'summary' },
      formatters: [],
      inlineLabel: false,
      label: 'Title',
      layout: { columnSpan: { default: 2 } },
      path: 'title',
      placeholder: null,
      properties: {},
      slots: {},
      type: 'text',
      visible: true,
    }).snapshot
    expect(assertEntryPresentation(entry, {
      extraAttributes: { 'data-kind': 'summary' },
      layout: { columnSpan: { default: 2 } },
      visible: true,
    })).toBe(entry)
  })
})
