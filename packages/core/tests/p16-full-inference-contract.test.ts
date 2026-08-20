import { column, defineGeneratedTable, defineModel, hasMany } from '@holo-js/db'
import { field, schema } from '@holo-js/forms'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  advancedColumnsFor,
  clientExpression,
  clientResolver,
  columnsFor,
  actionsFor,
  createExtensionTypeId,
  defineCustomPage,
  defineDashboard,
  defineExporter,
  defineImporter,
  definePanel,
  definePanelPlugin,
  defineResource,
  defineSchema,
  defineStatsWidget,
  entriesFor,
  fields,
  filtersFor,
  relationManagersFor,
  serverResolver,
  summariesFor,
  type DashboardBuilder,
  type PageBuilder,
  type PanelPluginBuilder,
  type ResourceExecutionContext,
  type ResourceCompositionTypes,
  type StatsWidgetData,
  type WidgetBuilder,
} from '../src'

class Actor {
  readonly id = 'actor-1'
  readonly role = 'admin'
}

class Tenant {
  readonly id = 'tenant-1'
  readonly slug = 'acme'
}

class Services {
  readonly audit = { write: (_event = '') => undefined }
}

class ResolverContext {
  readonly actor = new Actor()
  readonly tenant = new Tenant()
}

class RelationQuery {
  readonly scoped = true
}

const postsTable = defineGeneratedTable('inference_posts', {
  active: column.boolean(),
  id: column.id(),
  score: column.integer(),
  tenantId: column.string(),
  title: column.string(),
})
const commentsTable = defineGeneratedTable('inference_comments', {
  id: column.id(),
  postId: column.integer(),
  tenantId: column.string(),
  title: column.string(),
})
const PostModel = defineModel(postsTable)
const CommentModel = defineModel(commentsTable)
const postForm = schema({
  active: field.boolean().default(false),
  score: field.number().required(),
  title: field.string().required(),
})

describe('complete public value-source inference contract', () => {
  it('infers every consumer callback and builder without manual type declarations', () => {
    const panel = definePanel('admin', Actor)
      .access(context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        return context.actor?.role === 'admin'
      })
      .tenancy({
        authorize: (tenant, context) => {
          expectTypeOf(tenant).toEqualTypeOf<Tenant>()
          expectTypeOf(context.actor).toEqualTypeOf<Actor>()
          return tenant.id.length > 0
        },
        findMembershipById: async id => id === 'tenant-1' ? new Tenant() : null,
        findMembershipByRouteKey: async routeKey => routeKey === 'acme' ? new Tenant() : null,
        identify: tenant => tenant.id,
        memberships: async () => ({ nextCursor: null, tenants: [new Tenant()] }),
        model: Tenant,
        persistence: {
          clear: async () => undefined,
          load: async () => 'tenant-1',
          save: async () => undefined,
        },
        present: tenant => ({ label: tenant.slug }),
        routeKey: tenant => tenant.slug,
      })

    const posts = defineResource(PostModel, { actor: Actor, tenant: Tenant })
      .tenantScope((query, context) => {
        expectTypeOf(context).toEqualTypeOf<ResourceExecutionContext<Actor, Tenant>>()
        return query.where('tenantId', '=', context.tenant.id)
      })
      .readOnly()
    const comments = defineResource(CommentModel, { actor: Actor, tenant: Tenant })
      .nestedUnder(posts, {
        relationship: 'comments',
        scope: (query, parent, context) => {
          expectTypeOf(parent.title).toEqualTypeOf<string>()
          expectTypeOf(context.actor).toEqualTypeOf<Actor | null>()
          return query.where('postId', '=', parent.id)
        },
      })
      .readOnly()
    const relationManagers = relationManagersFor({
      actor: Actor,
      input: { create: () => ({ title: '' }) },
      owner: PostModel,
      pivot: { create: () => ({ featured: false }) },
      query: RelationQuery,
      related: CommentModel,
      tenant: Tenant,
      value: Number,
    })
    const commentsRelation = relationManagers.define({
      authorization: {
        authorizeOwner: async (_operation, context) => {
          expectTypeOf(context.owner.title).toEqualTypeOf<string>()
          expectTypeOf(context.actor).toEqualTypeOf<Actor | null>()
        },
        authorizeRelated: async (_operation, related, context) => {
          expectTypeOf(related.postId).toEqualTypeOf<number>()
          expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
        },
      },
      persistence: {
        applyAuthorizationScope: query => query,
        applyTenantScope: (query, context) => {
          expectTypeOf(query).toEqualTypeOf<RelationQuery>()
          expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
          return query
        },
        create: async input => CommentModel.create({ title: input.title }),
        createQuery: () => new RelationQuery(),
        delete: async () => undefined,
        find: async () => undefined,
        list: async (_query, request) => ({ hasMore: false, page: request.page, perPage: request.perPage, records: [] }),
        scopeToOwner: query => query,
        update: async related => related,
      },
      relation: hasMany(() => CommentModel, 'postId'),
      relationName: 'comments',
      transaction: { run: operation => operation() },
    })
    const postsWithRelations = posts.relations(commentsRelation)

    const formFields = fields(postForm)
    const formTitle = formFields.text('title').default(context => {
      expectTypeOf(context.value).toEqualTypeOf<string>()
      expectTypeOf(context.values.score).toEqualTypeOf<number>()
      return context.value
    })
    expect(postsWithRelations.compile().relations[0]).toBe(commentsRelation)
    const layout = defineSchema('post-layout', PostModel)
    const tableColumns = columnsFor(PostModel)
    const tableFilters = filtersFor(PostModel, ResolverContext)
    const tableSummaries = summariesFor(PostModel, ResolverContext)
    const infolistEntries = entriesFor(PostModel)
    const advancedColumns = advancedColumnsFor(PostModel)
    const composedPosts = posts
      .form([formTitle])
      .table([tableColumns.text('title')])
      .infolist([infolistEntries.text('title')])

    const actions = actionsFor({
      actor: Actor,
      input: { create: () => ({ title: '' }) },
      record: { create: () => ({ id: 0, title: '' }) },
      services: Services,
      tenant: Tenant,
    })
    expect(composedPosts.compile().form).toHaveLength(1)
    const action = actions.builtin('edit', {
      update: async (record, input) => {
        expectTypeOf(record.id).toEqualTypeOf<number>()
        expectTypeOf(input.title).toEqualTypeOf<string>()
        return { ...record, title: input.title }
      },
    }, {
      authorize: context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
        expectTypeOf(context.services).toEqualTypeOf<Services>()
        expectTypeOf(context.record?.id).toEqualTypeOf<number | undefined>()
        return context.actor.role === 'admin'
      },
    })
    const viewAction = actions.view({
      authorize: context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.record?.id).toEqualTypeOf<number | undefined>()
        return true
      },
    })
    const customAction = actions.custom({
      authorize: context => {
        expectTypeOf(context.services).toEqualTypeOf<Services>()
        return true
      },
      handle: async (input, context) => {
        expectTypeOf(input.title).toEqualTypeOf<string>()
        expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
        return { actorId: context.actor.id, title: input.title }
      },
      id: 'publish',
      kind: 'custom',
      label: 'Publish',
      mount: 'record',
      transactional: true,
    })
    const resolver = serverResolver('tenant-label', ResolverContext, context => {
      expectTypeOf(context.actor).toEqualTypeOf<Actor>()
      return context.tenant.slug
    })
    const expression = clientExpression(Boolean, { operator: 'equals', operands: [1, 1] })
    const namedResolver = clientResolver(String, 'format.slug', 'Post Title')

    class PostsResource {
      declare readonly resourceCompositionTypes: ResourceCompositionTypes<Awaited<ReturnType<typeof PostModel.create>>, Actor, Tenant>
      static model = PostModel
      static getSlug(): string { return posts.id }
    }

    const importer = defineImporter('posts-import', PostsResource)
      .authorize(context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.tenant).toEqualTypeOf<Tenant>()
        return true
      })
    const exporter = defineExporter('posts-export', PostsResource)
      .computed('tenant', context => {
        expectTypeOf(context.actor).toEqualTypeOf<Actor>()
        expectTypeOf(context.records[0]?.title).toEqualTypeOf<string | undefined>()
        return context.records.map(() => context.tenant.id)
      })

    const page = defineCustomPage('overview', {
      actor: Actor,
      load: context => ({ actor: context.actor.id, tenant: context.tenant.slug }),
      services: Services,
      tenant: Tenant,
    })
    const widget = defineStatsWidget('totals', { actor: Actor, services: Services, tenant: Tenant })
      .data(context => ({ stats: [{ action: null, chart: [], color: null, description: null, icon: null, id: 'tenant', label: context.tenant.slug, trend: null, url: null, value: context.actor.id }] }))
    const dashboard = defineDashboard('overview', { actor: Actor, services: Services, tenant: Tenant })
      .authorize(context => context.services.audit.write(context.actor.id) === undefined)

    const fieldType = createExtensionTypeId('acme', 'field', 'money')
    const customField = formFields.custom('score', fieldType, {
      codec: {
        decode: value => typeof value === 'number' ? value : 0,
        encode: value => value,
      },
      properties: { currency: 'USD' },
    })
    const plugin = definePanelPlugin({
      actor: Actor,
      compatibility: {
        panels: { maximumExclusive: '2.0.0', minimum: '1.0.0' },
        protocol: { maximumExclusive: '2.0', minimum: '1.0' },
      },
      id: 'acme.money',
      packageName: '@acme/panels-money',
      tenant: Tenant,
    }).authorization({
      authorize: request => {
        expectTypeOf(request.actor).toEqualTypeOf<Actor>()
        expectTypeOf(request.tenant).toEqualTypeOf<Tenant>()
      },
      id: 'money-access',
    })

    expectTypeOf(action.handle).parameter(0).toHaveProperty('title').toEqualTypeOf<string>()
    expectTypeOf(action.handle).returns.resolves.toEqualTypeOf<{ id: number, title: string }>()
    expectTypeOf(viewAction.handle).returns.resolves.toMatchTypeOf<{ id: number, title: string }>()
    expectTypeOf(customAction.handle).returns.resolves.toEqualTypeOf<{ actorId: string, title: string }>()
    expectTypeOf(resolver.resolve).parameter(0).toEqualTypeOf<ResolverContext>()
    expectTypeOf(expression.valueType).toMatchTypeOf<boolean | undefined>()
    expectTypeOf(namedResolver.valueType).toMatchTypeOf<string | undefined>()
    expectTypeOf(page).toEqualTypeOf<PageBuilder<{ actor: string, tenant: string }, Actor, Tenant, Services>>()
    expectTypeOf(widget).toEqualTypeOf<WidgetBuilder<StatsWidgetData, Actor, Tenant, Services>>()
    expectTypeOf(dashboard).toEqualTypeOf<DashboardBuilder<Actor, Tenant, Services>>()
    expectTypeOf(plugin).toEqualTypeOf<PanelPluginBuilder<Actor, Tenant>>()
    expectTypeOf(customField.compile().defaultValue).toEqualTypeOf<number | undefined>()
    expectTypeOf(formTitle.compile().defaultValue).toEqualTypeOf<string | undefined>()
    expectTypeOf(tableColumns.text('title').compile().manifest.path).toEqualTypeOf<'title'>()
    tableFilters.ternary('active', 'active').indicator((_value, context) => {
      expectTypeOf(context.context).toEqualTypeOf<ResolverContext>()
      return context.context.tenant.slug
    })
    tableSummaries.custom('score-total', context => {
      expectTypeOf(context.context).toEqualTypeOf<ResolverContext>()
      return context.context.actor.id.length
    })
    expectTypeOf(infolistEntries.text('title')).toHaveProperty('compile')
    expectTypeOf(advancedColumns.column('score', 'score', 'score', 'number', ['=']).path).toEqualTypeOf<'score'>()

    expect(panel.compile().manifest.id).toBe('admin')
    expect(comments.compile().nested?.parent.id).toBe('inference-posts')
    expect(commentsRelation.operations(['create', 'edit', 'delete']).compile().id).toBe('comments')
    expect(layout.compile().id).toBe('post-layout')
  })
})
