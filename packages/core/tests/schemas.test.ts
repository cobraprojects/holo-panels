import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  type CalloutBuilder,
  type CustomComponentBuilder,
  type GridBuilder,
  type SchemaBuilder,
  callout,
  customComponent,
  defineSchema,
  emptyState,
  fieldset,
  grid,
  group,
  schemaComponentsFor,
  section,
  split,
  step,
  tab,
  tabs,
  wizard,
} from '../src/schemas'
import type {
  CompiledSchemaComponent,
  SchemaPath,
  SchemaValueAtPath,
} from '../src/schemas'
import {
  applySchemaNodePatches,
  evaluateSchemaVisibility,
  findSchemaComponent,
  patchSchemaNode,
  traverseSchema,
} from '../src/schemas/traversal'

class FormValues {
  declare account: {
    email: string
    profile: {
      displayName: string
    }
  }
  declare enabled: boolean
}

class VisibilityContext {
  declare readonly role: 'admin' | 'member'
}

describe('schemas and layouts', () => {
  it('compiles every shared layout into a deeply frozen nested tree', () => {
    const schema = defineSchema('settings')
      .components([
        grid([
          section([
            group([
              fieldset([
                callout().heading('Notice').description('Review this form'),
              ]).label('Profile').collapsible().persistCollapse('profile-collapse'),
            ]),
          ]).heading('Account'),
          tabs([
            tab([emptyState().heading('Nothing here')]).label('Empty'),
          ]).persist('settings-tab'),
          wizard([
            step([customComponent('acme:review').properties({ mode: 'compact' })]).label('Review'),
          ]).persist('settings-step'),
          split([callout().heading('Left'), callout().heading('Right')]).from('lg'),
        ]).columns({ default: 1, md: 2, xl: 4 }),
      ])
      .compile()

    const kinds: string[] = []
    traverseSchema(schema, component => kinds.push(component.kind))

    expect(kinds).toEqual([
      'grid',
      'section',
      'group',
      'fieldset',
      'callout',
      'tabs',
      'tab',
      'empty-state',
      'wizard',
      'step',
      'custom',
      'split',
      'callout',
      'callout',
    ])
    expect(schema.components[0]?.layout.columns).toEqual({ default: 1, md: 2, xl: 4 })
    expect(findSchemaComponent(schema, 'settings.grid-0.section-0-0.group-0-0-0.fieldset-0-0-0-0')?.properties.collapse).toEqual({
      collapsible: true,
      collapsed: false,
      persistenceKey: 'profile-collapse',
    })
    expect(Object.isFrozen(schema)).toBe(true)
    expect(Object.isFrozen(schema.components[0]?.children)).toBe(true)
  })

  it('derives stable component keys and nested state paths', () => {
    const components = schemaComponentsFor(FormValues)
    const schema = defineSchema('profile', FormValues)
      .statePath('account')
      .components([
        components.section([
          components.custom('acme:text').key('display-name').statePath('displayName'),
        ]).key('profile-section').statePath('profile'),
      ])
      .compile()

    const sectionNode = schema.components[0]
    const customNode = sectionNode?.children[0]
    expect(sectionNode).toMatchObject({
      id: 'profile.profile-section',
      key: 'profile-section',
      statePath: 'account.profile',
    })
    expect(customNode).toMatchObject({
      id: 'profile.profile-section.display-name',
      key: 'display-name',
      statePath: 'account.profile.displayName',
    })
    expect(defineSchema('stable').components([callout()]).compile().components[0]?.key).toBe('callout-0')
  })

  it('keeps dynamic visibility callbacks in server handles', async () => {
    const components = schemaComponentsFor(class Values {}, VisibilityContext)
    const component = components.callout()
      .heading('Admin only')
      .visible(context => context.role === 'admin')
    const node = defineSchema('visibility', class Values {}, VisibilityContext)
      .components([component])
      .compile()
      .components[0]!

    expect(node.dynamicVisibility).toBe(true)
    expect(node.visible).toBe(true)
    expect(node.server.visibility).toBeTypeOf('function')
    expect(await evaluateSchemaVisibility(node, { role: 'admin' })).toBe(true)
    expect(await evaluateSchemaVisibility(node, { role: 'member' })).toBe(false)
    expect(JSON.parse(JSON.stringify({ ...node, server: undefined }))).not.toHaveProperty('server')
  })

  it('normalizes responsive spans, starts, ordering, collapsing, and named render slots', () => {
    const node = defineSchema('responsive').components([
      section()
        .key('content')
        .columnSpan({ default: 'full', md: 2 })
        .columnStart({ md: 2 })
        .order({ default: 2, lg: -1 })
        .collapsible()
        .collapsed()
        .persistCollapse('content-collapse')
        .before('acme:before')
        .before({ component: 'acme:priority', order: -10, properties: { compact: true } })
        .after('acme:after')
        .above('acme:above')
        .below('acme:below'),
    ]).compile().components[0]!

    expect(node.layout).toEqual({
      columnSpan: { default: 'full', md: 2 },
      columnStart: { md: 2 },
      order: { default: 2, lg: -1 },
    })
    expect(node.properties.collapse).toEqual({
      collapsible: true,
      collapsed: true,
      persistenceKey: 'content-collapse',
    })
    expect(node.slots).toEqual({
      before: [
        { component: 'acme:priority', order: -10, properties: { compact: true }, source: 'component' },
        { component: 'acme:before', order: 0, properties: {}, source: 'component' },
      ],
      after: [{ component: 'acme:after', order: 0, properties: {}, source: 'component' }],
      above: [{ component: 'acme:above', order: 0, properties: {}, source: 'component' }],
      below: [{ component: 'acme:below', order: 0, properties: {}, source: 'component' }],
    })
    expect(() => section().before('acme:duplicate').before('acme:duplicate')).toThrow('Duplicate')
  })

  it('supports custom component contracts with JSON-safe properties', () => {
    const node = defineSchema('custom').components([
      customComponent('vendor:map')
        .key('location')
        .properties({ zoom: 8, controls: ['pan', 'zoom'], config: { interactive: true } })
        .extraAttributes({ class: 'map', 'data-map': 'location' }),
    ]).compile().components[0]!

    expect(node).toMatchObject({
      kind: 'custom',
      type: 'vendor:map',
      properties: {
        customType: 'vendor:map',
        customProperties: { zoom: 8, controls: ['pan', 'zoom'], config: { interactive: true } },
      },
    })
    expect(() => customComponent('vendor:map').properties({ url: 'javascript:alert(1)' }).compileComponent({
      schemaId: 'unsafe',
      parentId: 'unsafe',
      position: [0],
    })).toThrow('unsafe URL')
  })

  it('traverses in preorder and applies immutable targeted node patches', () => {
    const schema = defineSchema('patches').components([
      grid([
        callout().key('first').heading('First'),
        callout().key('second').heading('Second'),
      ]).key('grid'),
    ]).compile()
    const visited: Array<[string, number, string | undefined]> = []
    traverseSchema(schema, (node, context) => visited.push([node.id, context.depth, context.parent?.id]))

    const patched = patchSchemaNode(schema, 'patches.grid.second', {
      visible: false,
      properties: { heading: 'Updated' },
    })

    expect(visited).toEqual([
      ['patches.grid', 0, undefined],
      ['patches.grid.first', 1, 'patches.grid'],
      ['patches.grid.second', 1, 'patches.grid'],
    ])
    expect(findSchemaComponent(patched, 'patches.grid.second')).toMatchObject({
      visible: false,
      properties: { heading: 'Updated' },
    })
    expect(findSchemaComponent(schema, 'patches.grid.second')?.visible).toBe(true)
    expect(patched.components[0]?.children[0]).toBe(schema.components[0]?.children[0])
    expect(Object.isFrozen(patched)).toBe(true)
    expect(() => applySchemaNodePatches(schema, [
      { id: 'patches.grid.first', changes: { visible: false } },
      { id: 'patches.grid.first', changes: { visible: true } },
    ])).toThrow('Duplicate schema patch target')
    expect(() => patchSchemaNode(schema, 'patches.missing', { visible: false })).toThrow('not found')
  })

  it('rejects duplicate keys and invalid responsive or persistence state', () => {
    expect(() => defineSchema('duplicates').components([
      callout().key('same'),
      emptyState().key('same'),
    ]).compile()).toThrow('Duplicate schema component key')
    expect(() => defineSchema('columns').components([grid().columns({ md: 0 })]).compile()).toThrow('Invalid column count')
    expect(() => defineSchema('span').components([callout().columnSpan(0)]).compile()).toThrow('Invalid column span')
    expect(() => defineSchema('collapse').components([section().collapsed()]).compile()).toThrow('must be collapsible')
    expect(() => callout().before('<script>')).toThrow('named registered component')
    expect(() => section().statePath('__proto__.polluted')).toThrow('Invalid state path')
  })

  it('preserves precise fluent and nested path types', () => {
    const components = schemaComponentsFor(FormValues, VisibilityContext)
    const schema = defineSchema('typed', FormValues, VisibilityContext)
    const gridBuilder = components.grid().columns(2).key('grid')
    const customBuilder = components.custom('acme:typed').key('custom')

    expectTypeOf(schema).toEqualTypeOf<SchemaBuilder<FormValues, VisibilityContext>>()
    expectTypeOf(gridBuilder).toEqualTypeOf<GridBuilder<FormValues, VisibilityContext>>()
    expectTypeOf(customBuilder).toEqualTypeOf<CustomComponentBuilder<FormValues, VisibilityContext>>()
    expectTypeOf(callout()).toEqualTypeOf<CalloutBuilder>()
    expectTypeOf<SchemaPath<FormValues>>().toEqualTypeOf<'account' | 'account.email' | 'account.profile' | 'account.profile.displayName' | 'enabled'>()
    expectTypeOf<SchemaValueAtPath<FormValues, 'account.profile.displayName'>>().toEqualTypeOf<string>()
    expectTypeOf<CompiledSchemaComponent<VisibilityContext>['server']['visibility']>()
      .toEqualTypeOf<((context: VisibilityContext) => boolean | Promise<boolean>) | undefined>()
  })
})
