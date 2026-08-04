import { describe, expect, expectTypeOf, it } from 'vitest'
import { column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import {
  callout,
  column,
  definePanel,
  defineRelationManager,
  defineResource,
  defineSchema,
  defineTable,
  field,
  schemaComponentsFor,
  type PanelDefinition,
} from '../src/index'

const posts = defineGeneratedTable('posts', {
  id: databaseColumn.id(),
  published: databaseColumn.boolean(),
  title: databaseColumn.string(),
})
const Post = defineModel(posts, { fillable: ['published', 'title'] })
type PostRecord = Awaited<ReturnType<typeof Post.create>>

describe('generated definition APIs', () => {
  it('builds discoverable fluent panel definitions', () => {
    const panel = definePanel('admin')
      .default()
      .path('/admin')
      .guard('admin')
      .discoverResources()
      .discoverPages()
      .discoverWidgets()
      .discoverClusters()

    expectTypeOf(panel).toEqualTypeOf<PanelDefinition>()
    expect(panel.compileDiscoveryDefinition()).toEqual({
      discoveryMarker: '@holo-js/panels/discovery/v1',
      kind: 'panel',
      navigationKeys: [],
      id: 'admin',
      route: '/admin',
      default: true,
      discover: {
        clusters: 'clusters',
        pages: 'pages',
        resources: 'resources',
        widgets: 'widgets',
      },
      client: { path: '/admin' },
      server: { plugins: [] },
    })
    expect(panel.guardName).toBe('admin')
  })

  it('preserves concrete model fields through compact and split resource definitions', () => {
    const compact = defineResource(Post)
      .form([
        field.text('title').required(),
        field.boolean('published'),
      ])
      .table([
        column.text('title'),
        column.boolean('published'),
      ])
      .shared()
    const schema = defineSchema(Post).fields([field.text('title')])
    const table = defineTable(Post).columns([column.text('title')])
    const split = defineResource(Post).form(schema).table(table).shared()
    const splitDefinition = split.compile()

    expect(compact.compileDiscoveryDefinition().id).toBe('posts')
    expect(splitDefinition.form).toBe(schema)
    expect(splitDefinition.table).toBe(table)
    expect(defineRelationManager('comments', Post).kind).toBe('relation-manager')
  })

  it('preserves generated resource schemas while exposing named compiled schemas', () => {
    const generated = defineSchema(Post).fields([field.text('title')])
    const components = schemaComponentsFor(Post)
    const compiled = defineSchema('post-form', Post)
      .components([components.callout().key('notice').heading('Review')])
      .compile()

    expect(generated.components).toHaveLength(1)
    expect(compiled.components[0]).toMatchObject({
      id: 'post-form.notice',
      kind: 'callout',
    })
  })
})
