import {
  advancedColumnsFor,
  columnsFor,
  createExtensionTypeId,
  definePanel,
  defineCustomPage,
  defineDashboard,
  defineResource,
  defineSchema,
  defineStatsWidget,
  entriesFor,
  filtersFor,
  rendererRegistryName,
  summariesFor,
  type AdvancedColumnFactory,
  type ColumnFactory,
  type EntryFactory,
  type FilterFactory,
  type PanelBuilder,
  type PageBuilder,
  type ResourceExecutionContext,
  type DashboardBuilder,
  type StatsWidgetData,
  type WidgetBuilder,
  type SummaryFactory,
  type SchemaBuilder,
} from '../src'
import { column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import { globalSearchFor, type RegisteredGlobalSearchResource } from '../src/search'
import { describe, expect, expectTypeOf, it } from 'vitest'

class Post {
  readonly active = true
  readonly title = ''
  readonly total = 0
}

class QueryContext {
  readonly locale = 'en'
}

class Actor {
  readonly id = 0
  readonly role = ''
}

class Tenant {
  readonly id = ''
}

class Services {
  readonly revision = 0
}

class SearchQuery {
  readonly scoped = true
}

describe('public authoring inference', () => {
  it('derives record, context, and actor types from runtime sources', () => {
    const columns: ColumnFactory<Post> = columnsFor(Post)
    const entries: EntryFactory<Post> = entriesFor(Post)
    const advanced: AdvancedColumnFactory<Post> = advancedColumnsFor(Post)
    const filters: FilterFactory<Post, QueryContext> = filtersFor(Post, QueryContext)
    const summaries: SummaryFactory<Post, QueryContext> = summariesFor(Post, QueryContext)
    const panel: PanelBuilder<Actor> = definePanel('admin', Actor)
    const schema: SchemaBuilder<Post, QueryContext> = defineSchema('post', Post, QueryContext)
    const page = defineCustomPage('overview', {
      actor: Actor,
      load: context => ({ count: context.services.revision, status: context.actor.role }),
      services: Services,
      tenant: Tenant,
    })
    const widget = defineStatsWidget('totals', { actor: Actor, services: Services, tenant: Tenant })
    const dashboard = defineDashboard('dashboard', { actor: Actor, services: Services, tenant: Tenant })
    const postsTable = defineGeneratedTable('posts', { id: databaseColumn.id(), tenantId: databaseColumn.string(), title: databaseColumn.string() })
    const PostModel = defineModel(postsTable)
    const resource = defineResource(PostModel, { actor: Actor, tenant: String })
      .tenantScope((query, context) => {
        expectTypeOf(query).toEqualTypeOf<ReturnType<typeof PostModel.query>>()
        expectTypeOf(context).toEqualTypeOf<ResourceExecutionContext<Actor, string>>()
        return query.where('tenantId', '=', context.tenant)
      })
    const resourceWidget = defineStatsWidget('resource-totals', { actor: Actor, tenant: String })
    const resourceSchema = defineSchema('resource-post', PostModel)
    const resourceEntries = entriesFor(PostModel)
    const resourcePage = defineCustomPage('resource-overview', {
      actor: Actor,
      load: () => ({ ready: true }),
      tenant: String,
    })
    const incompatibleWidget = defineStatsWidget('incompatible', { actor: QueryContext, tenant: String })
    const invalidResourceComposition = (): void => {
      // @ts-expect-error widget actor context does not match the resource actor
      resource.widgets(incompatibleWidget)
    }
    const composedResource = resource
      .form(resourceSchema)
      .infolist([resourceEntries.text('title')])
      .pages(resourcePage)
      .widgets(resourceWidget)
      .readOnly()
    const definePostSearch = globalSearchFor({ actor: Actor, query: SearchQuery, record: Post, tenant: Tenant })
    const search = definePostSearch({
      applySearch: query => query,
      attributes: ['title'],
      authorizeResource: context => context.actor.role.length > 0,
      authorizeResults: records => records.map(() => ({ actions: [], page: true, result: true })),
      createQuery: () => new SearchQuery(),
      execute: async query => query.scoped ? [new Post()] : [],
      guard: 'web',
      id: 'posts',
      panelId: 'admin',
      resultId: 'title',
      resultUrl: record => `/posts/${record.title}`,
      scopeAuthorization: query => query,
      scopeTenant: (query, context) => context.tenant.id ? query : query,
      title: 'title',
    })

    expectTypeOf(page).toEqualTypeOf<PageBuilder<{ count: number, status: string }, Actor, Tenant, Services>>()
    expectTypeOf(widget).toEqualTypeOf<WidgetBuilder<StatsWidgetData, Actor, Tenant, Services>>()
    expectTypeOf(dashboard).toEqualTypeOf<DashboardBuilder<Actor, Tenant, Services>>()
    expectTypeOf(search).toEqualTypeOf<RegisteredGlobalSearchResource<Actor, Tenant>>()
    expect(resource.id).toBe('posts')
    expect(composedResource.compile().infolist).toHaveLength(1)
    expectTypeOf(invalidResourceComposition).toBeFunction()
    widget.data(context => ({ stats: context.tenant.id ? [] : [] }))
    dashboard.authorize(context => context.actor.id === context.services.revision)

    expect(columns.text('title').compile().manifest.path).toBe('title')
    expect(entries.text('title').compile().manifest.path).toBe('title')
    expect(advanced.column('total', 'total', 'posts.total', 'number', ['=']).path).toBe('total')
    expect(filters.ternary('active', 'active').compile().manifest.id).toBe('active')
    expect(summaries.sum('total', 'total').compile().manifest.path).toBe('total')
    expect(panel.presentActor(actor => ({ id: actor.id, role: actor.role })).compile().manifest.id).toBe('admin')
    expect(schema.compile().id).toBe('post')
    expect(rendererRegistryName('column', createExtensionTypeId('acme', 'column', 'money'))).toBe('column.acme.column.money')
  })
})
