import { belongsToMany, column, defineGeneratedTable, defineModel, hasMany, hasManyThrough } from '@holo-js/db'
import {
  RelationManagerBuilder,
  RelationManagerExecutor,
  RelationOperationNotAllowedError,
  RelationRecordNotFoundError,
  type RelationManagerContext,
  type RelationPersistence,
} from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import { runRelationAcceptanceJourney } from '../src/relation-acceptance'
import { loadExampleExport } from './load-example'

type RelationAcceptanceFixture = Parameters<typeof runRelationAcceptanceJourney>[0]

const [nextRelationAcceptanceFixture, nuxtRelationAcceptanceFixture, svelteKitRelationAcceptanceFixture] = await Promise.all([
  loadExampleExport<RelationAcceptanceFixture>('next', 'p10-relation-acceptance-next', 'nextRelationAcceptanceFixture'),
  loadExampleExport<RelationAcceptanceFixture>('nuxt', 'p10-relation-acceptance-nuxt', 'nuxtRelationAcceptanceFixture'),
  loadExampleExport<RelationAcceptanceFixture>('sveltekit', 'p10-relation-acceptance-sveltekit', 'svelteKitRelationAcceptanceFixture'),
])

interface Owner {
  readonly id: number
  readonly tenantId: string
}

interface Related extends Record<string, unknown> {
  id: number
  ownerId: number
  position: number
  tenantId: string
  title: string
}

interface Query {
  authorized: boolean
  ownerId?: number
  tenantId?: string
}

interface Input extends Readonly<Record<string, unknown>> {
  readonly title: string
}

interface Pivot extends Readonly<Record<string, unknown>> {
  readonly position: number
}

const relatedTable = defineGeneratedTable('p10_acceptance_related', {
  id: column.id(),
  ownerId: column.integer(),
  position: column.integer(),
  tenantId: column.string(),
  title: column.string(),
})
const throughTable = defineGeneratedTable('p10_acceptance_through', { id: column.id(), ownerId: column.integer() })
const RelatedModel = defineModel(relatedTable)
const ThroughModel = defineModel(throughTable)
const signal = new AbortController().signal

function context(): RelationManagerContext<Owner, { readonly id: string }, string> {
  return { actor: { id: 'admin-1' }, owner: { id: 1, tenantId: 'tenant-a' }, signal, tenant: 'tenant-a' }
}

function services(records: Related[], membership: Set<number>, events: string[]): {
  readonly authorization: {
    authorizeOwner(operation: string): Promise<void>
    authorizeRelated(operation: string, record: Related): Promise<void>
  }
  readonly persistence: RelationPersistence<Owner, Related, Query, Input, Pivot, number, { readonly id: string }, string>
  readonly transaction: { run<TResult>(operation: () => Promise<TResult>): Promise<TResult> }
} {
  return {
    authorization: {
      async authorizeOwner(operation): Promise<void> { events.push(`owner:${operation}`) },
      async authorizeRelated(operation, record): Promise<void> {
        events.push(`related:${operation}:${record.id}`)
        if (record.id === 13) throw new Error('denied relation record')
      },
    },
    persistence: {
      createQuery: () => ({ authorized: false }),
      scopeToOwner(query, scope) { query.ownerId = scope.owner.id; return query },
      applyTenantScope(query, scope) { query.tenantId = scope.tenant; return query },
      applyAuthorizationScope(query) { query.authorized = true; return query },
      async list(query, request) {
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
      async find(query, id) { return records.find(record => record.id === id && record.ownerId === query.ownerId && record.tenantId === query.tenantId && query.authorized && (membership.size === 0 || membership.has(record.id))) },
      async create(input, scope) {
        const record = { id: 50 + records.length, ownerId: scope.owner.id, position: 0, tenantId: scope.tenant, title: input.title }
        records.push(record)
        events.push(`create:${record.id}`)
        return record
      },
      async update(record, input) { record.title = input.title; return record },
      async delete(record) { records.splice(records.indexOf(record), 1); membership.delete(record.id); events.push(`delete:${record.id}`) },
      async associate(record, scope) { record.ownerId = scope.owner.id; events.push(`associate:${record.id}`) },
      async dissociate(record) { if (record) record.ownerId = 0; events.push(`dissociate:${record?.id ?? 'empty'}`) },
      async attach(record, pivot) { membership.add(record.id); record.ownerId = 1; record.position = pivot.position; events.push(`attach:${record.id}`) },
      async detach(record) { membership.delete(record.id); events.push(`detach:${record.id}`) },
      async updatePivot(record, pivot) { record.position = pivot.position; events.push(`pivot:${record.id}:${pivot.position}`) },
      async listOptions(_request, scope) {
        const available = records.filter(record => record.tenantId === scope.tenant && !membership.has(record.id))
        return { records: available, page: 1, perPage: 50, hasMore: false, total: available.length }
      },
      async hydrateOptions(_request, selected, scope) { return records.filter(record => selected.includes(record.id) && record.tenantId === scope.tenant) },
      optionValue: record => record.id,
      optionLabel: record => record.title,
    },
    transaction: { async run(operation) { events.push('transaction'); return operation() } },
  }
}

async function executeRelationJourney(): Promise<readonly string[]> {
  const records: Related[] = [
    { id: 10, ownerId: 1, position: 0, tenantId: 'tenant-a', title: 'Comment' },
    { id: 11, ownerId: 2, position: 0, tenantId: 'tenant-a', title: 'Wrong owner' },
    { id: 12, ownerId: 1, position: 0, tenantId: 'tenant-b', title: 'Wrong tenant' },
    { id: 13, ownerId: 1, position: 0, tenantId: 'tenant-a', title: 'Denied' },
    { id: 20, ownerId: 1, position: 1, tenantId: 'tenant-a', title: 'TypeScript' },
    { id: 21, ownerId: 2, position: 0, tenantId: 'tenant-a', title: 'Holo' },
  ]
  const events: string[] = []
  const commentServices = services(records, new Set(), events)
  const comments = new RelationManagerExecutor(new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, { readonly id: string }, string>({
    relationName: 'comments',
    relation: hasMany(() => RelatedModel, 'ownerId'),
    ...commentServices,
  }).fields(['title']).compile())
  await comments.create({ title: 'Created comment' }, context())
  await comments.associate(11, context())
  await comments.dissociate(10, context())
  await expect(comments.view(12, context())).rejects.toBeInstanceOf(RelationRecordNotFoundError)
  await expect(comments.view(13, context())).rejects.toThrow('denied relation record')

  const membership = new Set([20])
  const tagServices = services(records, membership, events)
  const tags = new RelationManagerExecutor(new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, { readonly id: string }, string>({
    relationName: 'tags',
    relation: belongsToMany(() => RelatedModel, 'post_tags', 'post_id', 'tag_id'),
    ...tagServices,
  }).operations(['attach', 'detach', 'editPivot']).pivotFields(['position']).compile())
  await tags.attach(21, { position: 2 }, context())
  await tags.editPivot(20, { position: 3 }, context())
  await tags.detach(20, context())

  const through = new RelationManagerBuilder<Owner, Related, Query, Input, Pivot, number, { readonly id: string }, string>({
    relationName: 'commentsThroughAuthors',
    relation: hasManyThrough(() => RelatedModel, () => ThroughModel, 'ownerId', 'ownerId', 'id', 'id'),
    ...commentServices,
  }).compile()
  await expect(new RelationManagerExecutor(through).delete(11, context())).rejects.toBeInstanceOf(RelationOperationNotAllowedError)
  return events
}

describe('P10 relation-manager phase gate', () => {
  it('runs the Post/Comments and Post/Tags journey through all example renderers', async () => {
    for (const fixture of [nextRelationAcceptanceFixture, nuxtRelationAcceptanceFixture, svelteKitRelationAcceptanceFixture]) {
      const report = await runRelationAcceptanceJourney(fixture)
      const events = await executeRelationJourney()

      expect(report.framework).toBe(fixture.framework)
      expect(report.render.ssrStable).toBe(true)
      expect(report.render.markup).toContain('data-panels-component="relation-managers"')
      expect(report.render.markup).toContain('data-panels-component="data-table"')
      expect(report.render.markup).toContain('hp-table-responsive')
      expect(report.render.markup).toContain('hp-relation-table-overflow')
      expect(report.render.markup).toContain('hp-table-row-actions')
      expect(report.render.markup).toContain('data-label="Comment"')
      expect(report.render.markup).toContain('First comment')
      expect(report.render.markup).toContain('TypeScript')
      expect(report.render.markup).toContain('role="tablist"')
      expect(report.render.markup).toContain('role="tabpanel"')
      expect(report.render.markup).toContain('Editorial')
      expect(report.render.markup).toContain('/admin/posts/1/relations/audit')
      expect(report.render.markup).toContain('Edit pivot')
      expect(report.render.markup).not.toContain('Private notes')
      expect(events).toEqual(expect.arrayContaining(['associate:11', 'dissociate:10', 'attach:21', 'pivot:20:3', 'detach:20']))
    }
  })
})
