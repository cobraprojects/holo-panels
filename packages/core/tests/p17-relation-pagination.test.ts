import { describe, expect, it, vi } from 'vitest'
import {
  RelationListPaginationError,
  RelationManagerExecutor,
  type RelationManagerContext,
} from '../src/relations'

interface Owner {
  readonly id: number
}

interface Related {
  readonly id: number
}

interface Query {
  readonly ownerId: number
}

interface Actor {
  readonly id: string
}

const signal = new AbortController().signal
const context: RelationManagerContext<Owner, Actor, string> = {
  actor: { id: 'actor-1' },
  owner: { id: 1 },
  signal,
  tenant: 'tenant-1',
}

function executor(list: (query: Query, request: { readonly includeTotal: boolean, readonly page: number, readonly perPage: number }) => Promise<{
  readonly hasMore: boolean
  readonly page: number
  readonly perPage: number
  readonly records: readonly Related[]
  readonly total?: number
}>): RelationManagerExecutor<Owner, Related, Query, Readonly<Record<never, never>>, Readonly<Record<never, never>>, number, Actor, string> {
  return new RelationManagerExecutor({
    badge: null,
    authorization: {
      authorizeOwner: async () => undefined,
      authorizeRelated: async () => undefined,
    },
    group: null,
    id: 'records',
    operations: ['list'],
    persistence: {
      applyAuthorizationScope: query => query,
      applyTenantScope: query => query,
      create: async () => ({ id: 1 }),
      createQuery: scope => ({ ownerId: scope.owner.id }),
      delete: async () => undefined,
      find: async () => undefined,
      list,
      scopeToOwner: query => query,
      update: async record => record,
    },
    presentation: 'inline',
    relation: {} as never,
    relationName: 'records',
    transaction: { run: operation => operation() },
    visible: () => true,
    writableInputFields: [],
    writablePivotFields: [],
  })
}

describe('bounded relation record listing', () => {
  it('normalizes defaults and returns a frozen bounded page', async () => {
    const list = vi.fn(async (_query: Query, request: { readonly includeTotal: boolean, readonly page: number, readonly perPage: number }) => ({
      hasMore: false,
      page: request.page,
      perPage: request.perPage,
      records: [{ id: 1 }],
      total: 1,
    }))

    const page = await executor(list).list({}, context)

    expect(list).toHaveBeenCalledWith({ ownerId: 1 }, { includeTotal: true, page: 1, perPage: 25 })
    expect(page.records).toEqual([{ id: 1 }])
    expect(Object.isFrozen(page)).toBe(true)
    expect(Object.isFrozen(page.records)).toBe(true)
  })

  it('rejects unsafe requests before persistence runs', async () => {
    const list = vi.fn()
    const relation = executor(list)

    await expect(relation.list({ perPage: 101 }, context)).rejects.toBeInstanceOf(RelationListPaginationError)
    await expect(relation.list({ page: 0 }, context)).rejects.toBeInstanceOf(RelationListPaginationError)
    await expect(relation.list({ unexpected: true } as never, context)).rejects.toBeInstanceOf(RelationListPaginationError)
    expect(list).not.toHaveBeenCalled()
  })

  it('rejects overproduction and inconsistent totals', async () => {
    const tooMany = Array.from({ length: 3 }, (_, index) => ({ id: index }))
    const relation = executor(async (_query, request) => ({
      hasMore: false,
      page: request.page,
      perPage: request.perPage,
      records: tooMany,
      total: tooMany.length,
    }))

    await expect(relation.list({ perPage: 2 }, context)).rejects.toBeInstanceOf(RelationListPaginationError)

    const inconsistent = executor(async (_query, request) => ({
      hasMore: true,
      page: request.page,
      perPage: request.perPage,
      records: [],
      total: request.perPage,
    }))
    await expect(inconsistent.list({}, context)).rejects.toBeInstanceOf(RelationListPaginationError)
  })
})
