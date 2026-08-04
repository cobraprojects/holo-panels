import { describe, expect, it, vi } from 'vitest'
import { defineResource } from '../src/resources/builder'
import { ResourceExecutor, ResourceRecordNotFoundError } from '../src/resources/executor'
import type {
  ResourceAuthorization,
  ResourceExecutionContext,
  ResourceModel,
  ResourceParentRegistry,
  ResourceQuery,
  ResourceRecord,
} from '../src/resources/contracts'

interface ChildAttributes {
  readonly id: number
  readonly parentId: number
  readonly title: string
}

class ParentRecord implements ResourceRecord {
  constructor(readonly id: number) {}

  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  async restore(): Promise<this> { return this }
  toJSON(): { readonly id: number } { return { id: this.id } }
  async update(): Promise<this> { return this }
}

class ChildRecord implements ResourceRecord {
  values: ChildAttributes

  constructor(values: ChildAttributes) {
    this.values = values
  }

  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  async restore(): Promise<this> { return this }
  toJSON(): ChildAttributes { return { ...this.values } }
  async update(values: Readonly<Record<string, unknown>>): Promise<this> {
    this.values = { ...this.values, ...values }
    return this
  }
}

class ChildQuery implements ResourceQuery<ChildQuery, ChildRecord> {
  readonly #events: string[]
  readonly #records: readonly ChildRecord[]
  #id: number | string | undefined
  #parentId: number | undefined

  constructor(records: readonly ChildRecord[], events: string[]) {
    this.#events = events
    this.#records = records
  }

  async first(): Promise<ChildRecord | undefined> {
    this.#events.push('child:lookup')
    return this.#records.find(record => record.values.id === this.#id && record.values.parentId === this.#parentId)
  }

  forParent(parentId: number): this {
    this.#events.push('child:nested-scope')
    this.#parentId = parentId
    return this
  }

  where(_column: string, _operator: '=', id: number | string): this {
    this.#events.push('child:where')
    this.#id = id
    return this
  }
}

class ParentQuery implements ResourceQuery<ParentQuery, ParentRecord> {
  async first(): Promise<ParentRecord | undefined> { return undefined }
}

interface Actor {
  readonly id: string
}

function context(tenant = 'tenant-a'): ResourceExecutionContext<Actor, string> {
  return { actor: { id: 'actor-1' }, signal: new AbortController().signal, tenant }
}

function parentResource() {
  const model: ResourceModel<ParentRecord, ParentQuery> = {
    definition: { fillable: [], name: 'Account', primaryKey: 'id', softDeletes: false },
    async create(): Promise<ParentRecord> { return new ParentRecord(10) },
    getConnectionName: () => undefined,
    query: () => new ParentQuery(),
    async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> { return callback() },
  }
  return defineResource(model).shared().readOnly()
}

describe('P16 nested resource execution', () => {
  it('authorizes and resolves the parent before applying the mandatory child scope', async () => {
    const events: string[] = []
    const children = [
      new ChildRecord({ id: 1, parentId: 10, title: 'Expected' }),
      new ChildRecord({ id: 2, parentId: 20, title: 'Other parent' }),
    ]
    const model: ResourceModel<ChildRecord, ChildQuery> = {
      definition: {
        fillable: ['title'],
        guarded: ['id', 'parentId'],
        name: 'Child',
        primaryKey: 'id',
        softDeletes: false,
        table: { columns: { id: {}, parentId: {}, title: {} } },
      },
      async create(values: Readonly<Record<string, unknown>>): Promise<ChildRecord> {
        events.push('child:create')
        return new ChildRecord({ id: 3, parentId: 10, title: String(values.title) })
      },
      getConnectionName: () => undefined,
      query(): ChildQuery {
        events.push('child:query')
        return new ChildQuery(children, events)
      },
      async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> { return callback() },
    }
    const definition = defineResource(model)
      .shared()
      .writableAttributes(['title'])
      .baseQuery(query => {
        events.push('child:base-scope')
        return query
      })
      .nestedUnder(parentResource(), {
        relationship: 'children',
        scope: (query, parent) => query.forParent(parent.id),
      })
      .compile()
    const authorization: ResourceAuthorization<typeof model, ChildRecord, Actor> = {
      async authorizeClass(): Promise<void> { events.push('child:class-authorized') },
      async authorizeRecord(): Promise<void> { events.push('child:record-authorized') },
    }
    const registry: ResourceParentRegistry<Actor, unknown> = {
      async resolveAuthorized(reference, identifier, executionContext): Promise<ResourceRecord | null> {
        events.push(`parent:resolve:${reference.id}:${String(reference.routeKey)}:${String(identifier)}`)
        return identifier === 10 && executionContext.tenant === 'tenant-a' ? new ParentRecord(10) : null
      },
    }
    const transaction = { run: async <TResult>(operation: () => Promise<TResult>): Promise<TResult> => operation() }
    const executor = new ResourceExecutor(definition, {
      authorization,
      nested: { parentIdentifier: 10, registry },
      transaction,
    })

    await expect(executor.serialize(1, context())).resolves.toEqual({ id: 1, parentId: 10, title: 'Expected' })
    expect(events).toEqual([
      'child:class-authorized',
      'child:query',
      'child:base-scope',
      'parent:resolve:accounts:id:10',
      'child:nested-scope',
      'child:where',
      'child:lookup',
      'child:record-authorized',
    ])

    events.length = 0
    await expect(executor.serialize(2, context())).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
    expect(events).not.toContain('child:record-authorized')

    events.length = 0
    await expect(executor.update(2, { title: 'Guessed' }, context())).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
    expect(children[1]?.values.title).toBe('Other parent')
    expect(events).not.toContain('child:record-authorized')

    events.length = 0
    await expect(executor.serialize(1, context('tenant-b'))).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
    expect(events).not.toContain('child:nested-scope')
    expect(events).not.toContain('child:lookup')
  })

  it('returns not found for an unauthorized parent before child scope, lookup, or mutation', async () => {
    const events: string[] = []
    const model: ResourceModel<ChildRecord, ChildQuery> = {
      definition: {
        fillable: ['title'],
        guarded: ['id', 'parentId'],
        name: 'Child',
        primaryKey: 'id',
        softDeletes: false,
        table: { columns: { id: {}, parentId: {}, title: {} } },
      },
      async create(): Promise<ChildRecord> {
        events.push('child:create')
        return new ChildRecord({ id: 3, parentId: 10, title: 'Created' })
      },
      getConnectionName: () => undefined,
      query(): ChildQuery {
        events.push('child:query')
        return new ChildQuery([], events)
      },
      async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> { return callback() },
    }
    const definition = defineResource(model)
      .shared()
      .writableAttributes(['title'])
      .nestedUnder(parentResource(), {
        relationship: 'children',
        scope: (query, parent) => query.forParent(parent.id),
      })
      .compile()
    const registry: ResourceParentRegistry<object, unknown> = {
      async resolveAuthorized(): Promise<null> {
        events.push('parent:not-found')
        return null
      },
    }
    const authorization = {
      authorizeClass: vi.fn(async () => undefined),
      authorizeRecord: vi.fn(async () => undefined),
    }
    const executor = new ResourceExecutor(definition, {
      authorization,
      nested: { parentIdentifier: 999, registry },
      transaction: { run: async operation => operation() },
    })

    await expect(executor.serialize(1, context())).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
    expect(events).toEqual(['child:query', 'parent:not-found'])
    expect(authorization.authorizeRecord).not.toHaveBeenCalled()

    events.length = 0
    await expect(executor.create({ title: 'Blocked' }, context())).rejects.toBeInstanceOf(ResourceRecordNotFoundError)
    expect(events).toEqual(['parent:not-found'])
    expect(events).not.toContain('child:create')
  })

  it('requires server-bound parent execution metadata for every nested operation', async () => {
    const events: string[] = []
    const model: ResourceModel<ChildRecord, ChildQuery> = {
      definition: { fillable: ['title'], name: 'Child', primaryKey: 'id', softDeletes: false },
      async create(): Promise<ChildRecord> { return new ChildRecord({ id: 1, parentId: 1, title: 'Child' }) },
      getConnectionName: () => undefined,
      query: () => new ChildQuery([], events),
      async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> { return callback() },
    }
    const definition = defineResource(model)
      .shared()
      .writableAttributes(['title'])
      .nestedUnder(parentResource(), {
        relationship: 'children',
        scope: (query, parent) => query.forParent(parent.id),
      })
      .compile()
    const executor = new ResourceExecutor(definition, {
      authorization: { authorizeClass: async () => undefined, authorizeRecord: async () => undefined },
      transaction: { run: async operation => operation() },
    })

    await expect(executor.serialize(1, context())).rejects.toThrow('authorized parent registry')
  })
})
