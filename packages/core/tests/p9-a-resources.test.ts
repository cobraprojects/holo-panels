import { column, defineGeneratedTable, defineModel } from '@holo-js/db'
import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { ResourceBuilder, defineResource } from '../src/resources/builder'
import { ResourceExecutor, ResourceInputError, ResourceRecordNotFoundError } from '../src/resources/executor'
import type {
  ResourceAuthorization,
  ResourceExecutionContext,
  ResourceInput,
  ResourceModel,
  ResourceQuery,
  ResourceRecord,
  ResourceRecordFor,
  ResourceTransaction,
} from '../src/resources/contracts'

interface PostAttributes {
  readonly id: number
  readonly password: string
  readonly tenantId: string
  readonly title: string
}

class PostRecord implements ResourceRecord {
  deleted = false
  forceDeleted = false
  restored = false
  values: PostAttributes

  constructor(values: PostAttributes) {
    this.values = values
  }

  async delete(): Promise<void> {
    this.deleted = true
  }

  async forceDelete(): Promise<void> {
    this.forceDeleted = true
  }

  async restore(): Promise<this> {
    this.restored = true
    return this
  }

  toJSON(): PostAttributes {
    return { ...this.values }
  }

  async update(values: Readonly<Record<string, unknown>>): Promise<this> {
    this.values = { ...this.values, ...values }
    return this
  }
}

class PostQuery implements ResourceQuery<PostQuery, PostRecord> {
  readonly #events: string[]
  readonly #records: readonly PostRecord[]
  #id?: number | string
  #tenant?: string

  constructor(records: readonly PostRecord[], events: string[]) {
    this.#records = records
    this.#events = events
  }

  async first(): Promise<PostRecord | undefined> {
    this.#events.push('lookup')
    return this.#records.find(record => record.values.id === this.#id && record.values.tenantId === this.#tenant)
  }

  tenant(tenant: string): this {
    this.#events.push('tenant')
    this.#tenant = tenant
    return this
  }

  where(_column: string, _operator: '=', value: number | string): this {
    this.#events.push('where')
    this.#id = value
    return this
  }

  withTrashed(): this {
    this.#events.push('trashed')
    return this
  }
}

interface Actor {
  readonly id: string
}

const records = [
  new PostRecord({ id: 1, password: 'secret-a', tenantId: 'tenant-a', title: 'Alpha' }),
  new PostRecord({ id: 2, password: 'secret-b', tenantId: 'tenant-b', title: 'Beta' }),
]

function fixture(events: string[], softDeletes = true): {
  readonly model: ResourceModel<PostRecord, PostQuery>
  readonly authorization: ResourceAuthorization<ResourceModel<PostRecord, PostQuery>, PostRecord, Actor>
  readonly transaction: ResourceTransaction
} {
  const model: ResourceModel<PostRecord, PostQuery> = {
    definition: {
      fillable: ['title'],
      guarded: ['id', 'tenantId'],
      hidden: ['password'],
      name: 'Post',
      primaryKey: 'id',
      softDeletes,
      table: { columns: { id: {}, password: {}, tenantId: {}, title: {} } },
    },
    async create(values: Readonly<Record<string, unknown>>): Promise<PostRecord> {
      events.push('create')
      return new PostRecord({ id: 3, password: 'generated', tenantId: String(values.tenantId), title: String(values.title) })
    },
    getConnectionName: () => undefined,
    query(): PostQuery {
      events.push('query')
      return new PostQuery(records, events)
    },
    async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> {
      events.push('unguarded')
      return callback()
    },
  }
  return {
    model,
    authorization: {
      async authorizeClass(_actor, operation): Promise<void> {
        events.push(`class:${operation}`)
      },
      async authorizeRecord(_actor, operation, record): Promise<void> {
        events.push(`record:${operation}`)
        if (record.values.id === 1 && operation === 'delete') throw new Error('record denied')
      },
    },
    transaction: {
      async run<TResult>(operation: () => Promise<TResult>): Promise<TResult> {
        events.push('transaction:start')
        try {
          const result = await operation()
          events.push('transaction:commit')
          return result
        } catch (error) {
          events.push('transaction:rollback')
          throw error
        }
      },
    },
  }
}

function context(tenant = 'tenant-a'): ResourceExecutionContext<Actor, string> {
  return { actor: { id: 'actor-1' }, signal: new AbortController().signal, tenant }
}

function resource(events: string[], lifecycle = {}): ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, boolean> {
  const { model } = fixture(events)
  return new ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, boolean>(model)
    .recordTitle('title')
    .routeKey('id')
    .writableAttributes(['title'])
    .tenantScope((query, scope: ResourceExecutionContext<Actor, string>) => query.tenant(scope.tenant))
    .lifecycle(lifecycle)
}

function builder(model = fixture([]).model): ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, boolean> {
  return new ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, boolean>(model)
}

describe('P9-A resources', () => {
  it('infers Holo model fields and composes a callback-free discovery seed', () => {
    const posts = defineGeneratedTable('resource_posts', {
      id: column.id(),
      slug: column.string(),
      title: column.string(),
    })
    const Post = defineModel(posts, { fillable: ['slug', 'title'] })
    const definition = defineResource(Post)
      .recordTitle('title')
      .routeKey('slug')
      .slug('articles')
      .navigation({ group: 'Content', icon: 'document-text', label: 'Posts', sort: 10 })
      .globalSearch({ attributes: ['title'], details: ['slug'], limit: 12, title: 'title' })
      .form({ id: 'post.form' })
      .infolist({ id: 'post.infolist' })
      .table({ id: 'post.table' })
      .pages({ id: 'list' }, { id: 'edit' })
      .relations({ id: 'comments' })
      .widgets({ id: 'stats' })
      .writableAttributes(['slug', 'title'])
      .shared()
      .compile()

    expectTypeOf(definition.model).toEqualTypeOf<ResourceModel<ResourceRecordFor<typeof Post>, ReturnType<typeof Post.query>>>()
    expectTypeOf(definition.recordTitle).toMatchTypeOf<string>()
    expectTypeOf(definition.capabilities.restore).toEqualTypeOf<false>()
    expectTypeOf<ResourceInput<PostRecord>['title']>().toEqualTypeOf<string | undefined>()
    expect(definition).toMatchObject({ id: 'resource-posts', recordTitle: 'title', routeKey: 'slug', slug: 'articles' })
    expect(definition.client).toEqual({
      capabilities: { delete: true, forceDelete: false, restore: false },
      globalSearch: true,
      navigation: { group: 'Content', icon: 'document-text', label: 'Posts', sort: 10 },
      recordTitle: 'title',
      routeKey: 'slug',
      slug: 'articles',
      softDeletes: false,
    })
    expect(JSON.stringify(definition.client)).not.toContain('baseQuery')
  })

  it('requires an automatic tenant scope at execution and keeps configured variants immutable', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const base = builder(setup.model).writableAttributes(['title'])
    const tenantScoped = base.compile()
    await expect(new ResourceExecutor(tenantScoped, setup).serialize(1, context())).rejects.toThrow(/authenticated tenant scope/u)

    const automaticContext = {
      ...context(),
      scopeTenantQuery: <TQuery>(query: TQuery): TQuery => (query as PostQuery).tenant('tenant-a') as TQuery,
      tenantBindings: { tenantId: 'tenant-a' },
    }
    await expect(new ResourceExecutor(tenantScoped, setup).serialize(1, automaticContext)).resolves.toMatchObject({ id: 1 })
    await expect(new ResourceExecutor(tenantScoped, setup).create({ title: 'Created' }, automaticContext)).resolves.toMatchObject({
      record: { values: { tenantId: 'tenant-a' } },
    })

    const shared = base.shared().navigation({ label: 'Posts' })
    const variant = shared.configured('archived-posts', configured => configured.slug('archive').navigation({ label: 'Archive' }))
    expect(shared.compile()).toMatchObject({ id: 'posts', recordTitle: 'id', slug: 'posts', navigation: { label: 'Posts' } })
    expect(variant.compile()).toMatchObject({ id: 'archived-posts', slug: 'archive', navigation: { label: 'Archive' } })
    expect(Object.isFrozen(variant.compile())).toBe(true)
    expect(() => shared.configured('other-posts', () => shared)).toThrow(/configured variant/u)
  })

  it('validates resource IDs and derives replacement component keys from configured variants', () => {
    const base = builder()
      .shared()
      .form({ id: 'first-form' })
      .form({ id: 'final-form' })
      .infolist({ id: 'first-infolist' })
      .infolist({ id: 'final-infolist' })
      .table({ id: 'first-table' })
      .table({ id: 'final-table' })
      .writableAttributes(['title'])

    expect(() => base.configured('../archive', configured => configured)).toThrow(/Invalid configured resource variant ID/u)
    const definition = base.configured('archived-posts', configured => configured).compile()
    expect(definition.componentKeys).toEqual([
      'archived-posts.form',
      'archived-posts.infolist',
      'archived-posts.table',
    ])
    expect(definition).toMatchObject({
      form: { id: 'final-form' },
      infolist: { id: 'final-infolist' },
      table: { id: 'final-table' },
    })
  })

  it('rejects guarded and hidden attributes across writable and public metadata APIs', () => {
    const model = fixture([]).model
    const base = builder(model).shared()

    expect(() => base.writableAttributes(['tenantId'])).toThrow(/Guarded or hidden attribute "tenantId"/u)
    expect(() => base.writableAttributes(['password'])).toThrow(/Guarded or hidden attribute "password"/u)
    expect(() => base.recordTitle('password')).toThrow(/Hidden attribute "password"/u)
    expect(() => base.routeKey('password')).toThrow(/Hidden attribute "password"/u)
    expect(() => base.globalSearch({ attributes: ['password'], title: 'title' })).toThrow(/Hidden attribute "password"/u)
    expect(() => base.globalSearch({ attributes: ['title'], details: ['password'], title: 'title' })).toThrow(/Hidden attribute "password"/u)
    expect(() => base.globalSearch({ attributes: ['title'], title: 'password' })).toThrow(/Hidden attribute "password"/u)

    const guardedAll = {
      ...model,
      definition: { ...model.definition, fillable: ['*'], guarded: ['*'] },
    }
    const guardedBuilder = builder(guardedAll).shared()
    expect(() => guardedBuilder.compile()).toThrow(/allow-list writable attributes/u)
    expect(() => guardedBuilder.writableAttributes(['title'])).toThrow(/Guarded or hidden attribute "title"/u)
  })

  it('supports approved fluent navigation and resource-relative discovery metadata', () => {
    const definition = builder()
      .shared()
      .writableAttributes(['title'])
      .navigationLabel('Posts')
      .navigationIcon('document-text')
      .discoverPages()
      .discoverRelationManagers('relations')
      .discoverWidgets('./dashboard-widgets')
      .compile()

    expect(definition.navigation).toEqual({ icon: 'document-text', label: 'Posts' })
    expect(definition.discover).toEqual({ pages: 'pages', relationManagers: 'relations', widgets: 'dashboard-widgets' })
    expect(() => builder().discoverPages('../pages')).toThrow(/resource-relative/u)
  })

  it('authorizes the class and applies base and tenant scopes before lookup and record policy', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const definition = new ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, boolean>(setup.model)
      .writableAttributes(['title'])
      .baseQuery(query => {
        events.push('base')
        return query
      })
      .tenantScope((query, scope: ResourceExecutionContext<Actor, string>) => query.tenant(scope.tenant))
      .compile()
    const executor = new ResourceExecutor(definition, setup)

    await expect(executor.serialize(1, context())).resolves.toEqual({ id: 1, tenantId: 'tenant-a', title: 'Alpha' })
    expect(events).toEqual(['class:viewAny', 'query', 'base', 'tenant', 'where', 'lookup', 'record:view'])
    await expect(executor.serialize(2, context())).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
  })

  it('rejects mass assignment and record-policy denial without persistence', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const executor = new ResourceExecutor(resource(events).compile(), setup)

    await expect(executor.update(1, { id: 99, title: 'Changed' }, context())).rejects.toBeInstanceOf(ResourceInputError)
    expect(records[0]?.values.id).toBe(1)
    await expect(executor.delete(1, context())).rejects.toThrow('record denied')
    expect(records[0]?.deleted).toBe(false)
    expect(events.filter(event => event === 'transaction:rollback')).toHaveLength(2)
  })

  it('stops class-policy denial before queries or persistence and rejects attributes injected by lifecycle hooks', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const denied = new ResourceExecutor(resource(events).compile(), {
      ...setup,
      authorization: {
        async authorizeClass(): Promise<void> {
          events.push('class:denied')
          throw new Error('class denied')
        },
        async authorizeRecord(): Promise<void> {
          events.push('record')
        },
      },
    })

    await expect(denied.create({ title: 'Denied' }, context())).rejects.toThrow('class denied')
    expect(events).toEqual(['transaction:start', 'class:denied', 'transaction:rollback'])

    events.length = 0
    const injected = resource(events, {
      beforeFill: async (input: Partial<PostAttributes>) => ({ ...input, tenantId: 'tenant-b' }),
    }).compile()
    await expect(new ResourceExecutor(injected, setup).create({ title: 'Injected' }, context())).rejects.toBeInstanceOf(ResourceInputError)
    expect(events).not.toContain('create')
    expect(events.at(-1)).toBe('transaction:rollback')
  })

  it('binds trusted tenant ownership during create without making it client writable', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const definition = resource(events)
      .createBindings(scope => ({ tenantId: scope.tenant }))
      .compile()
    const executor = new ResourceExecutor(definition, setup)

    await expect(executor.create({ tenantId: 'tenant-b', title: 'Injected' }, context())).rejects.toBeInstanceOf(ResourceInputError)
    await expect(executor.create({ title: 'Owned' }, context())).resolves.toMatchObject({
      record: { values: { tenantId: 'tenant-a', title: 'Owned' } },
    })
    expect(definition.writableAttributes).toEqual(['title'])
  })

  it('uses Holo model and entity persistence defaults inside the transaction lifecycle', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const lifecycle = {
      beforeFill: vi.fn(async (input: Partial<PostAttributes>) => ({ ...input, title: String(input.title).trim() })),
      beforeValidate: vi.fn(),
      beforeCreate: vi.fn(),
      beforeSave: vi.fn(),
      afterCreate: vi.fn(),
      afterSave: vi.fn(),
      beforeRedirect: vi.fn(() => '/posts'),
    }
    const executor = new ResourceExecutor(resource(events, lifecycle).validation({ validate: async () => { events.push('validate') } }).compile(), setup)

    await expect(executor.create({ title: ' New ' }, context())).resolves.toMatchObject({ record: { values: { title: 'New' } }, redirect: '/posts' })
    await expect(executor.update(1, { title: 'Updated' }, context())).resolves.toMatchObject({ record: { values: { title: 'Updated' } }, redirect: '/posts' })
    expect(lifecycle.beforeFill).toHaveBeenCalledTimes(2)
    expect(lifecycle.beforeCreate).toHaveBeenCalledTimes(1)
    expect(lifecycle.afterCreate).toHaveBeenCalledTimes(1)
    expect(lifecycle.beforeSave).toHaveBeenCalledTimes(2)
    expect(lifecycle.afterSave).toHaveBeenCalledTimes(2)
  })

  it('rolls back lifecycle failures and supports complete persistence replacement and soft deletes', async () => {
    const events: string[] = []
    const setup = fixture(events)
    const replacement = {
      create: vi.fn(async () => records[0] as PostRecord),
      delete: vi.fn(async () => undefined),
      forceDelete: vi.fn(async () => undefined),
      restore: vi.fn(async record => record),
      update: vi.fn(async record => record),
    }
    const failed = resource(events, { afterSave: async () => { throw new Error('after save failed') } }).persistence(replacement).compile()
    await expect(new ResourceExecutor(failed, setup).create({ title: 'Fail' }, context())).rejects.toThrow('after save failed')
    expect(events.at(-1)).toBe('transaction:rollback')

    const executor = new ResourceExecutor(resource(events).persistence(replacement).compile(), setup)
    await executor.restore(1, context())
    await executor.forceDelete(1, context())
    expect(replacement.restore).toHaveBeenCalledOnce()
    expect(replacement.forceDelete).toHaveBeenCalledOnce()

    const plainSetup = fixture([], false)
    const plainDefinition = new ResourceBuilder<ResourceModel<PostRecord, PostQuery>, PostRecord, PostQuery, Partial<PostAttributes>, Actor, string, false>(plainSetup.model)
      .writableAttributes(['title'])
      .tenantScope((query, scope: ResourceExecutionContext<Actor, string>) => query.tenant(scope.tenant))
      .compile()
    const plain = new ResourceExecutor(plainDefinition, plainSetup)
    await expect(plain.restore(1, context())).rejects.toThrow(/does not support restoration/u)
  })
})
