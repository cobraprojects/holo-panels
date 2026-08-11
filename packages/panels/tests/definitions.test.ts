import { describe, expect, expectTypeOf, it } from 'vitest'
import { belongsTo, column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import { ResourceBuilder } from '@holo-js/panels-core'
import {
  callout,
  column,
  definePanel,
  defineColumn,
  defineCustomPage,
  defineField,
  defineRelationManager,
  defineResource,
  defineSchema,
  defineTable,
  field,
  schemaComponentsFor,
  type PanelDefinition,
} from '../src/index'

const authors = defineGeneratedTable('authors', {
  id: databaseColumn.id(),
  name: databaseColumn.string(),
})
const Author = defineModel(authors, { fillable: ['name'] })
const posts = defineGeneratedTable('posts', {
  authorId: databaseColumn.integer(),
  id: databaseColumn.id(),
  published: databaseColumn.boolean(),
  title: databaseColumn.string(),
})
const Post = defineModel(posts, {
  fillable: ['authorId', 'published', 'title'],
  relations: { author: belongsTo(() => Author, 'authorId') },
})
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
    expect(panel.compileDiscoveryDefinition()).toMatchObject({
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

  it('infers Holo authentication and tenant context without definition type sources', () => {
    const page = defineCustomPage('overview')
      .loader(context => {
        expectTypeOf(context.actor.name).toEqualTypeOf<string | undefined>()
        expectTypeOf(context.tenant).toEqualTypeOf<string>()
        return { loaded: true }
      })

    expect(page.compileDiscoveryDefinition().id).toBe('overview')
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
    expect(splitDefinition.form).toEqual(schema.compile())
    expect(splitDefinition.table).toEqual(table.compile())
    expect(defineRelationManager('comments', Post).kind).toBe('relation-manager')
  })

  it('infers every model-bound field and relation column path from the Holo model', () => {
    const uploadPolicy = {
      acceptedExtensions: ['txt'],
      acceptedMimeTypes: ['text/plain'],
      directory: 'panels/uploads',
      disk: 'local',
      expiresInSeconds: 300,
      imageOnly: false,
      maximumFiles: 1,
      maximumSize: 1024,
      private: true,
    } as const
    const schema = defineSchema(Post).fields(field => [
      field.text('title').required(),
      field.checkbox('published'),
      field.select('authorId'),
      field.file('title', uploadPolicy),
    ])
    const table = defineTable(Post)
      .columns(column => [
        column.text('title').searchable(),
        column.boolean('published'),
        column.text('author.name').label('Author'),
      ])
      .filters(filter => [filter.boolean('published', 'published').label('Published')])
      .deferFilters()
      .groups(group => [group.group('published', 'published').collapsible()])
      .summaries(summary => [summary.count('posts-count').label('Posts')])
    const invalidDefinitions = (): void => {
      defineSchema(Post).fields(field => [
        // @ts-expect-error missing is not a model field
        field.text('missing'),
      ])
      defineTable(Post).columns(column => [
        // @ts-expect-error author.missing is not a related model path
        column.text('author.missing'),
      ])
      defineTable(Post).filters(filter => [
        // @ts-expect-error missing is not a model field
        filter.select('missing', 'missing'),
      ])
    }

    expectTypeOf(invalidDefinitions).toBeFunction()
    expect(schema.compile().fields).toEqual([
      expect.objectContaining({ path: 'title', required: true, type: 'text' }),
      expect.objectContaining({ path: 'published', type: 'checkbox' }),
      expect.objectContaining({ path: 'authorId', type: 'select' }),
      expect.objectContaining({ path: 'title', properties: { uploadPolicy: { ...uploadPolicy, conversions: [] } }, type: 'panels:field:upload' }),
    ])
    expect(table.compile().columns).toEqual([
      expect.objectContaining({ path: 'title', searchable: true, type: 'text' }),
      expect.objectContaining({ path: 'published', type: 'boolean' }),
      expect.objectContaining({ label: 'Author', path: 'author.name', type: 'text' }),
    ])
    expect(table.compile()).toMatchObject({
      filterMode: 'deferred',
      filters: [expect.objectContaining({ id: 'published', type: 'boolean' })],
      groups: [expect.objectContaining({ id: 'published', path: 'published' })],
      summaries: [expect.objectContaining({ id: 'posts-count', kind: 'count' })],
    })
  })

  it('rejects missing and value-incompatible compact components', () => {
    const invalidDefinitions = (): void => {
      // @ts-expect-error title is a string attribute
      defineResource(Post).form([field.boolean('title')])
      // @ts-expect-error published is a boolean attribute
      defineResource(Post).table([column.text('published')])
      // @ts-expect-error missing is not a model attribute
      defineResource(Post).form([field.text('missing')])
      // @ts-expect-error missing is not a model attribute
      defineSchema(Post).fields([field.text('missing')])
    }

    expectTypeOf(invalidDefinitions).toBeFunction()

    expect(field.text('title').label('Title').helperText('Public title').placeholder('Write a title').required()).toMatchObject({
      helperTextValue: 'Public title',
      labelValue: 'Title',
      placeholderValue: 'Write a title',
      requiredState: true,
    })
    expect(column.text('title').label('Title').searchable().sortable().toggleable()).toMatchObject({
      labelValue: 'Title',
      searchableState: true,
      sortableState: true,
      toggleableState: true,
    })
  })

  it('preserves resource subclasses across fluent configuration', () => {
    class PostResource extends ResourceBuilder<
      typeof Post,
      PostRecord,
      ReturnType<typeof Post.query>,
      Partial<ReturnType<PostRecord['toJSON']>>,
      object,
      unknown,
      false
    > {
      custom(): this {
        return this
      }
    }

    const resource = new PostResource(Post).shared().navigationLabel('Posts').custom()

    expect(resource).toBeInstanceOf(PostResource)
    expect(resource.compile().navigation.label).toBe('Posts')
  })

  it('builds customizable generated definitions', () => {
    class RendererContext {
      readonly locale = 'en'
    }

    const customField = defineField('rating', Number, RendererContext)
      .label('Rating')
      .renderer('app:field:rating')
      .properties({ maximum: 5 })
      .visible((value, context) => {
        expectTypeOf(value).toEqualTypeOf<number>()
        expectTypeOf(context).toEqualTypeOf<RendererContext>()
        return value >= 0 && context.locale.length > 0
      })
      .compile()
    const customColumn = defineColumn('rating').label('Rating').renderer('app:column:rating').compile()

    expect(customField).toMatchObject({
      definitionKind: 'field',
      id: 'rating',
      label: 'Rating',
      properties: { maximum: 5 },
      renderer: 'app:field:rating',
    })
    expect(customColumn.label).toBe('Rating')
  })

  it('infers resource action records and input from the resource model', () => {
    const resource = defineResource(Post)
      .actions(actions => [
        actions.action('publish')
          .authorize(context => {
            expectTypeOf(context.record).toEqualTypeOf<PostRecord | null>()
            expectTypeOf(context.actor.name).toEqualTypeOf<string | undefined>()
            expectTypeOf(context.tenant).toEqualTypeOf<string>()
            return context.record !== null
          })
          .action((input, context) => {
            expectTypeOf(input.title).toEqualTypeOf<string | undefined>()
            expectTypeOf(context.record).toEqualTypeOf<PostRecord | null>()
            return { published: true }
          }),
      ])
      .shared()

    expect(resource.compile().actions[0]?.id).toBe('publish')
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
