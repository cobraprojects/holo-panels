import {
  belongsToMany,
  column,
  defineGeneratedTable,
  defineModel,
  hasMany,
  hasManyThrough,
  hasOne,
  morphMany,
  morphOne,
  morphTo,
  morphToMany,
} from '@holo-js/db'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { RelationManagerBuilder } from '../src/relations/builder'
import type {
  RelationManagerAuthorization,
  RelationManagerContext,
  RelationManagerTransaction,
  RelationPersistence,
} from '../src/relations/contracts'
import {
  RelationManagerExecutor,
  RelationInputError,
  RelationOperationNotAllowedError,
  RelationPivotInputError,
  RelationRecordNotFoundError,
} from '../src/relations/executor'
import { allowedRelationOperations } from '../src/relations/metadata'

interface Owner {
  readonly id: number
  readonly tenantId: string
}

interface Related {
  readonly id: number
  readonly ownerId: number
  readonly tenantId: string
  readonly title: string
}

interface Actor {
  readonly id: string
}

interface Input extends Readonly<Record<string, unknown>> {
  readonly title: string
}

interface Pivot extends Readonly<Record<string, unknown>> {
  readonly featured?: boolean
  readonly position?: number
}

interface Query {
  authorized: boolean
  ownerId?: number
  tenantId?: string
}

const relatedTable = defineGeneratedTable('relation_related', {
  id: column.id(),
  ownerId: column.integer(),
  tenantId: column.string(),
  title: column.string(),
})
const ownerTable = defineGeneratedTable('relation_owners', {
  id: column.id(),
  tenantId: column.string(),
})
const throughTable = defineGeneratedTable('relation_through', {
  id: column.id(),
  ownerId: column.integer(),
})
const RelatedModel = defineModel(relatedTable)
const OwnerModel = defineModel(ownerTable)
const ThroughModel = defineModel(throughTable)

const records: readonly Related[] = [
  { id: 10, ownerId: 1, tenantId: 'tenant-a', title: 'Alpha' },
  { id: 11, ownerId: 2, tenantId: 'tenant-a', title: 'Wrong owner' },
  { id: 12, ownerId: 1, tenantId: 'tenant-b', title: 'Wrong tenant' },
  { id: 13, ownerId: 1, tenantId: 'tenant-a', title: 'Denied' },
]

function context(ownerId = 1, tenant = 'tenant-a'): RelationManagerContext<Owner, Actor, string> {
  return {
    actor: { id: 'actor-1' },
    owner: { id: ownerId, tenantId: tenant },
    signal: new AbortController().signal,
    tenant,
  }
}

function fixture(events: string[]): {
  readonly authorization: RelationManagerAuthorization<Owner, Related, Actor, string>
  readonly persistence: RelationPersistence<Owner, Related, Query, Input, Pivot, number, Actor, string>
  readonly transaction: RelationManagerTransaction
} {
  return {
    authorization: {
      async authorizeOwner(operation): Promise<void> {
        events.push(`owner:${operation}`)
      },
      async authorizeRelated(operation, related): Promise<void> {
        events.push(`related:${operation}:${related.id}`)
        if (related.id === 13) throw new Error('denied')
      },
    },
    persistence: {
      createQuery(): Query {
        events.push('query')
        return { authorized: false }
      },
      scopeToOwner(query, scope): Query {
        events.push('owner-scope')
        query.ownerId = scope.owner.id
        return query
      },
      applyTenantScope(query, scope): Query {
        events.push('tenant-scope')
        query.tenantId = scope.tenant
        return query
      },
      applyAuthorizationScope(query): Query {
        events.push('authorization-scope')
        query.authorized = true
        return query
      },
      async list(query, request) {
        events.push('list')
        const matching = records.filter(record => record.ownerId === query.ownerId && record.tenantId === query.tenantId && query.authorized)
        const offset = (request.page - 1) * request.perPage
        return {
          hasMore: offset + request.perPage < matching.length,
          page: request.page,
          perPage: request.perPage,
          records: matching.slice(offset, offset + request.perPage),
          ...(request.includeTotal ? { total: matching.length } : {}),
        }
      },
      async find(query, id): Promise<Related | undefined> {
        events.push(`find:${id}`)
        return records.find(record => record.id === id && record.ownerId === query.ownerId && record.tenantId === query.tenantId && query.authorized)
      },
      async create(input, scope): Promise<Related> {
        events.push(`create:${input.title}`)
        return { id: 20, ownerId: scope.owner.id, tenantId: scope.tenant, title: input.title }
      },
      async update(related, input): Promise<Related> {
        events.push(`update:${related.id}`)
        return { ...related, title: input.title }
      },
      async delete(related): Promise<void> {
        events.push(`delete:${related.id}`)
      },
      async associate(related): Promise<void> {
        events.push(`associate:${related.id}`)
      },
      async dissociate(related): Promise<void> {
        events.push(`dissociate:${related?.id ?? 'empty'}`)
      },
      async attach(related, pivot): Promise<void> {
        events.push(`attach:${related.id}:${String(pivot.position)}`)
      },
      async detach(related): Promise<void> {
        events.push(`detach:${related.id}`)
      },
      async updatePivot(related, pivot): Promise<void> {
        events.push(`pivot:${related.id}:${String(pivot.position)}`)
      },
      async listOptions(request, scope) {
        events.push('option-list')
        const available = records.filter(record => record.tenantId === scope.tenant && record.ownerId !== scope.owner.id)
        return {
          records: available.slice(0, request.perPage),
          page: request.page,
          perPage: request.perPage,
          hasMore: false,
          total: available.length,
        }
      },
      async hydrateOptions(_request, selected, scope): Promise<readonly Related[]> {
        events.push('option-hydrate')
        return records.filter(record => selected.includes(record.id) && record.tenantId === scope.tenant)
      },
      optionValue: record => record.id,
      optionLabel: record => record.title,
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

function hasManyManager(events: string[]) {
  const services = fixture(events)
  return new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, Actor, string>({
    relationName: 'comments',
    relation: hasMany(() => RelatedModel, 'ownerId'),
    ...services,
  }).fields(['title'])
}

function manyToManyManager(events: string[]) {
  const services = fixture(events)
  return new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, Actor, string>({
    relationName: 'tags',
    relation: belongsToMany(() => RelatedModel, 'owner_related', 'owner_id', 'related_id'),
    ...services,
  }).fields(['title'])
}

describe('P10 relation managers', () => {
  it('maps every relation family to safe default operations', () => {
    expect(allowedRelationOperations(hasOne(() => RelatedModel, 'ownerId'))).toEqual(['view', 'create', 'edit', 'delete'])
    expect(allowedRelationOperations(hasMany(() => RelatedModel, 'ownerId'))).toEqual([
      'list', 'view', 'create', 'edit', 'associate', 'dissociate', 'delete',
    ])
    expect(allowedRelationOperations(belongsToMany(() => RelatedModel, 'owner_related', 'owner_id', 'related_id'))).toEqual([
      'list', 'view', 'attach', 'detach', 'create', 'edit', 'editPivot',
    ])
    expect(allowedRelationOperations(morphOne(() => RelatedModel, 'commentable'))).toEqual(['view', 'create', 'edit', 'delete'])
    expect(allowedRelationOperations(morphMany(() => RelatedModel, 'commentable'))).toContain('associate')
    expect(allowedRelationOperations(morphTo('commentable'))).toEqual(['select', 'associate', 'dissociate', 'create'])
    expect(allowedRelationOperations(morphToMany(() => RelatedModel, 'taggable', 'taggables', 'tag_id'))).toContain('editPivot')
    expect(allowedRelationOperations(hasManyThrough(
      () => RelatedModel,
      () => ThroughModel,
      'ownerId',
      'ownerId',
      'id',
      'id',
    ))).toEqual(['list', 'view'])
  })

  it('preserves owner and related record types through fluent presentation configuration', () => {
    const definition = hasManyManager([])
      .id('post-comments')
      .presentation('groupedTabs', 'Discussion')
      .visibleWhen(scope => scope.owner.id > 0)
      .badge(scope => scope.owner.id)
      .compile()

    expectTypeOf(definition.visible).parameter(0).toMatchTypeOf<RelationManagerContext<Owner, Actor, string>>()
    expectTypeOf(definition.persistence.find).returns.resolves.toEqualTypeOf<Related | undefined>()
    expect(definition).toMatchObject({ id: 'post-comments', presentation: 'groupedTabs', group: 'Discussion' })
    expect(Object.isFrozen(definition)).toBe(true)
  })

  it('owner-scopes before tenant and authorization scopes and rejects wrong-owner or wrong-tenant IDs', async () => {
    const events: string[] = []
    const executor = new RelationManagerExecutor(hasManyManager(events).compile())

    await expect(executor.list({}, context())).resolves.toEqual({
      hasMore: false,
      page: 1,
      perPage: 25,
      records: [records[0], records[3]],
      total: 2,
    })
    expect(events.slice(1, 5)).toEqual(['query', 'owner-scope', 'tenant-scope', 'authorization-scope'])
    await expect(executor.view(11, context())).rejects.toBeInstanceOf(RelationRecordNotFoundError)
    await expect(executor.view(12, context())).rejects.toBeInstanceOf(RelationRecordNotFoundError)
    await expect(executor.view(13, context())).rejects.toThrow('denied')
  })

  it('validates constrained selection before associate and rejects unavailable tenant options', async () => {
    const events: string[] = []
    const manager = hasManyManager(events).operations(['associate']).compile()
    const executor = new RelationManagerExecutor(manager)

    await expect(executor.associate(11, context())).resolves.toBeUndefined()
    expect(events).toEqual([
      'transaction:start',
      'owner:associate',
      'option-hydrate',
      'related:associate:11',
      'associate:11',
      'transaction:commit',
    ])
    await expect(executor.associate(12, context())).rejects.toBeInstanceOf(RelationRecordNotFoundError)
  })

  it('executes owner-bound create, edit, delete, dissociate, and detach mutations transactionally', async () => {
    const events: string[] = []
    const hasManyExecutor = new RelationManagerExecutor(hasManyManager(events).compile())

    await expect(hasManyExecutor.create({ title: 'Created' }, context())).resolves.toMatchObject({
      ownerId: 1,
      tenantId: 'tenant-a',
      title: 'Created',
    })
    await expect(hasManyExecutor.edit(10, { title: 'Updated' }, context())).resolves.toMatchObject({ title: 'Updated' })
    await hasManyExecutor.delete(10, context())
    await hasManyExecutor.dissociate(10, context())

    const manyExecutor = new RelationManagerExecutor(manyToManyManager(events).compile())
    await manyExecutor.detach(10, context())

    expect(events).toContain('create:Created')
    expect(events).toContain('update:10')
    expect(events).toContain('delete:10')
    expect(events).toContain('dissociate:10')
    expect(events).toContain('detach:10')
    expect(events.filter(event => event === 'transaction:start')).toHaveLength(5)
    expect(events.filter(event => event === 'transaction:commit')).toHaveLength(5)
    const maliciousInput: Input & { readonly tenantId: string } = { title: 'Safe', tenantId: 'tenant-b' }
    await expect(hasManyExecutor.create(maliciousInput, context()))
      .rejects.toBeInstanceOf(RelationInputError)
  })

  it('keeps pivot validation and writes in one transaction and allow-lists pivot fields', async () => {
    const events: string[] = []
    const manager = manyToManyManager(events)
      .operations(['attach', 'detach', 'editPivot'])
      .pivotFields(['position'], {
        async validate(pivot): Promise<void> {
          events.push(`validate-pivot:${String(pivot.position)}`)
          if ((pivot.position ?? 0) < 1) throw new Error('invalid position')
        },
      })
      .compile()
    const executor = new RelationManagerExecutor(manager)

    await executor.attach(11, { position: 2 }, context())
    expect(events).toContain('validate-pivot:2')
    expect(events.indexOf('transaction:start')).toBeLessThan(events.indexOf('validate-pivot:2'))
    expect(events.indexOf('validate-pivot:2')).toBeLessThan(events.indexOf('attach:11:2'))
    await expect(executor.editPivot(10, { featured: true }, context())).rejects.toBeInstanceOf(RelationPivotInputError)
    expect(events.at(-1)).toBe('transaction:rollback')
    await expect(executor.attach(11, { position: 0 }, context())).rejects.toThrow('invalid position')
    expect(events.at(-1)).toBe('transaction:rollback')
  })

  it('exposes P6 option validation and prevents unsupported writes on through relations', async () => {
    const events: string[] = []
    const executor = new RelationManagerExecutor(hasManyManager(events).compile())
    const options = await executor.optionService().list({
      panelId: 'admin',
      resourceId: 'posts',
      fieldId: 'comments',
      tenantKey: 'tenant-a',
      locale: 'en',
      dependencies: {},
      search: '',
      page: 1,
      perPage: 10,
    }, context())
    expect(options.options).toEqual([{ value: 11, label: 'Wrong owner' }])

    const services = fixture(events)
    const through = new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, Actor, string>({
      relationName: 'commentsThroughAuthors',
      relation: hasManyThrough(() => RelatedModel, () => ThroughModel, 'ownerId', 'ownerId', 'id', 'id'),
      ...services,
    }).compile()
    await expect(new RelationManagerExecutor(through).delete(10, context())).rejects.toBeInstanceOf(RelationOperationNotAllowedError)
  })

  it('rejects invalid operation overrides and incomplete persistence contracts', () => {
    expect(() => hasManyManager([]).operations(['attach'])).toThrow(/does not allow operation/u)
    const services = fixture([])
    const { attach: _attach, ...persistence } = services.persistence
    expect(() => new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, Actor, string>({
      relationName: 'tags',
      relation: belongsToMany(() => OwnerModel, 'owner_related', 'owner_id', 'related_id'),
      ...services,
      persistence,
    }).compile()).toThrow(/"attach" requires/u)
  })
})
