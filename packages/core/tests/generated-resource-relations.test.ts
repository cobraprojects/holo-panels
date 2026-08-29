import { hasMany } from '@holo-js/db'
import { describe, expect, it } from 'vitest'
import { ResourceBuilder } from '../src/resources/builder'
import { createGeneratedResourcePage, executeGeneratedResourceOperation, generatedResourcePageManifests } from '../src/resources/generated-pages'
import type { ResourceModel, ResourceQuery, ResourceRecord } from '../src/resources/contracts'

class CommentRecord implements ResourceRecord {
  constructor(
    readonly id: string,
    readonly postId: string,
    public body: string,
  ) {}

  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  async restore(): Promise<this> { return this }
  toJSON(): Readonly<Record<string, unknown>> { return { body: this.body, id: this.id, postId: this.postId } }
  async update(values: Readonly<Record<string, unknown>>): Promise<this> {
    if (typeof values.body === 'string') this.body = values.body
    return this
  }
}

class PostRecord implements ResourceRecord {
  readonly comments = [new CommentRecord('comment-1', 'post-1', 'First comment')]
  readonly relationEvents: string[] = []

  constructor(readonly id: string, readonly title: string) {}

  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  getRelation(name: string): unknown {
    this.relationEvents.push('get')
    return name === 'comments' ? this.comments : undefined
  }
  async load(relation?: unknown): Promise<this> {
    const constraint = relation && typeof relation === 'object' ? Reflect.get(relation, 'constraint') : undefined
    if (typeof constraint === 'function') Reflect.apply(constraint, relation, [new CommentQuery(this.comments[0]!)])
    this.relationEvents.push('load')
    return this
  }
  async restore(): Promise<this> { return this }
  toJSON(): Readonly<Record<string, unknown>> { return { id: this.id, title: this.title } }
  async update(): Promise<this> { return this }
}

class PostQuery implements ResourceQuery<PostQuery, PostRecord> {
  constructor(readonly record: PostRecord) {}

  async first(): Promise<PostRecord> { return this.record }
  where(): this { return this }
}

class CommentQuery implements ResourceQuery<CommentQuery, CommentRecord> {
  constructor(readonly record: CommentRecord) {}

  async first(): Promise<CommentRecord> { return this.record }
  where(): this { return this }
}

const commentModel = {
  async create(): Promise<CommentRecord> { return new CommentRecord('created-comment', 'post-1', '') },
  definition: {
    fillable: ['body'],
    guarded: ['id', 'postId'],
    name: 'Comment',
    primaryKey: 'id',
    softDeletes: false,
    table: { columns: { body: { kind: 'text' }, id: { kind: 'string' }, postId: { kind: 'string' } } },
  },
  getConnectionName: () => undefined,
  query: () => new CommentQuery(new CommentRecord('comment-1', 'post-1', 'First comment')),
  unguarded: async <TResult>(operation: () => Promise<TResult>): Promise<TResult> => await operation(),
}

const commentsRelation = hasMany(() => commentModel as never, 'postId')
const post = new PostRecord('post-1', 'First post')
const postModel: ResourceModel<PostRecord, PostQuery> & {
  readonly definition: ResourceModel<PostRecord, PostQuery>['definition'] & {
    readonly relations: { readonly comments: typeof commentsRelation }
  }
} = {
  async create(): Promise<PostRecord> { return post },
  definition: {
    fillable: ['title'],
    guarded: ['id'],
    name: 'Post',
    primaryKey: 'id',
    relations: { comments: commentsRelation },
    softDeletes: false,
    table: { columns: { id: { kind: 'string' }, title: { kind: 'string' } } },
  },
  getConnectionName: () => undefined,
  query: () => new PostQuery(post),
  unguarded: operation => operation(),
}

class CommentsRelationManager {
  static readonly kind = 'relation-manager' as const
  static readonly resourceRecordType = post

  static compile(): object {
    return Object.freeze({
      actions: Object.freeze([
        Object.freeze({ id: 'edit', kind: 'edit', transactional: false, visible: true }),
        Object.freeze({ id: 'delete', kind: 'delete', transactional: false, visible: true }),
      ]),
      id: 'comments',
      kind: 'relation-manager',
      relationName: 'comments',
      table: Object.freeze({
        compile: () => Object.freeze({
          columns: Object.freeze([
            Object.freeze({ label: 'Message', path: 'body', searchable: true, sortable: true }),
          ]),
          filters: Object.freeze([
            Object.freeze({ defaultValue: null, id: 'message', label: 'Message', properties: {}, type: 'text' }),
          ]),
          serverFilters: Object.freeze([
            Object.freeze({
              manifest: Object.freeze({ id: 'message' }),
              queryDefinitions: Object.freeze({ messageBody: Object.freeze({ column: 'body', operators: Object.freeze(['like']) }) }),
              server: Object.freeze({
                encode: (value: unknown) => Object.freeze({ id: 'messageBody', operator: 'like', value: `%${String(value)}%` }),
              }),
            }),
          ]),
        }),
      }),
    })
  }
}

describe('generated resource relation managers', () => {
  it('executes registered bulk relation actions with the shared explicit selection payload', async () => {
    post.comments.splice(0, post.comments.length,
      new CommentRecord('comment-1', 'post-1', 'Alpha'),
      new CommentRecord('comment-2', 'post-1', 'Bravo'),
    )
    const selected: string[][] = []
    class BulkComments extends CommentsRelationManager {
      static override compile(): object {
        const compiled = super.compile()
        const table = Reflect.get(compiled, 'table') as { readonly compile: () => object }
        return {
          ...compiled,
          actions: [{
            authorize: () => true,
            handle: (_input: object, context: { readonly selectedRecords: readonly CommentRecord[] }) => selected.push(context.selectedRecords.map(record => record.id)),
            id: 'review-selected',
            kind: 'custom',
            label: 'Review selected',
            mount: 'bulk',
            transactional: false,
            usesDefaultHandler: false,
          }],
          table: { compile: () => ({ ...table.compile(), selection: { currentPageOnly: false, groupsOnly: false, maximum: 10 } }) },
        }
      }
    }
    const resource = new ResourceBuilder<typeof postModel, PostRecord, PostQuery>(postModel).shared().relations(BulkComments)

    const result = await executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: { actionId: 'review-selected', idempotencyKey: 'bulk-comments', intent: 'relation', managerId: 'comments', mount: 'bulk', ownerId: 'post-1', relationOperation: 'custom', resourceId: 'posts', selection: { mode: 'explicit', recordIds: ['comment-1', 'comment-2'] } },
    })

    expect(result.data.status).toBe('succeeded')
    expect(selected).toEqual([['comment-1', 'comment-2']])
    post.comments.splice(0, post.comments.length, new CommentRecord('comment-1', 'post-1', 'First comment'))
  })

  it('preserves relation action overrides and reauthorizes their execution', async () => {
    let allowed = true
    const saved: string[] = []
    class ConfiguredComments extends CommentsRelationManager {
      static override compile(): object {
        return { ...super.compile(), actions: [{
          authorize: () => allowed,
          confirmation: null,
          handle: (_input: object, context: { record: CommentRecord | null }) => { saved.push(context.record?.body ?? 'missing'); return 'reviewed' },
          id: 'review', kind: 'edit', label: 'Review comment', mount: 'record', transactional: false, usesDefaultHandler: false,
        }] }
      }
    }
    const resource = new ResourceBuilder<typeof postModel, PostRecord, PostQuery>(postModel).shared().relations(ConfiguredComments)
    const input = { context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null }, operation: 'action' as const, panelId: 'admin', payload: { actionId: 'review', idempotencyKey: 'review-comment', intent: 'relation', managerId: 'comments', ownerId: 'post-1', relatedId: 'comment-1', relationOperation: 'edit', resourceId: 'posts', values: {} } }
    const result = await executeGeneratedResourceOperation(resource, input)
    expect(saved).toEqual(['First comment'])
    expect(result.data.status).toBe('succeeded')
    expect(result.data.relations).toEqual(expect.arrayContaining([expect.objectContaining({ recordActions: [{ recordId: 'comment-1', actions: [expect.objectContaining({ confirmation: null, id: 'review', label: 'Review comment' })] }] })]))
    allowed = false
    await expect(executeGeneratedResourceOperation(resource, input)).rejects.toThrow('not authorized')
  })
  it('loads relation manager classes registered by a resource', async () => {
    const resource = new ResourceBuilder<typeof postModel, PostRecord, PostQuery>(postModel)
      .shared()
      .relations(CommentsRelationManager)
    const editManifest = generatedResourcePageManifests({ panelPath: '/admin', resource })
      .find(manifest => manifest.pageType === 'edit')

    if (!editManifest) throw new Error('Generated resources must have an edit page manifest.')

    const page = createGeneratedResourcePage(resource, editManifest)
    const load = page.server.load
    if (!load) throw new Error('Generated edit pages must have a load handler.')
    const data = await load({
      actor: { id: 'admin' },
      locale: 'en',
      panelId: 'admin',
      parameters: { record: 'post-1' },
      services: {},
      signal: new AbortController().signal,
      tenant: null,
    })

    expect(data.relations).toEqual([
      expect.objectContaining({
        columns: [{ key: 'body', label: 'Message', searchable: true, sortable: true }],
        id: 'comments',
        label: 'Comments',
        operations: ['edit', 'delete'],
        records: [{ id: 'comment-1', values: { body: 'First comment', id: 'comment-1', postId: 'post-1' } }],
      }),
    ])

    const updated = await executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: {
        intent: 'relation',
        managerId: 'comments',
        ownerId: 'post-1',
        relatedId: 'comment-1',
        relationOperation: 'edit',
        resourceId: 'posts',
        values: { body: 'Edited comment' },
      },
    })

    expect(updated.data.relations).toEqual([
      expect.objectContaining({
        id: 'comments',
        records: [{ id: 'comment-1', values: { body: 'Edited comment', id: 'comment-1', postId: 'post-1' } }],
      }),
    ])

    await expect(executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: {
        intent: 'relation',
        managerId: 'comments',
        ownerId: 'post-1',
        relationOperation: 'create',
        resourceId: 'posts',
      },
    })).rejects.toThrow('The relation operation is not registered for this relation manager.')
  })

  it('loads an authorized relation table page through the shared table-data operation', async () => {
    post.comments.splice(0, post.comments.length,
      new CommentRecord('comment-1', 'post-1', 'Alpha'),
      new CommentRecord('comment-2', 'post-1', 'Bravo'),
      new CommentRecord('comment-3', 'post-1', 'Beta'),
    )
    const resource = new ResourceBuilder<typeof postModel, PostRecord, PostQuery>(postModel)
      .shared()
      .relations(CommentsRelationManager)

    const result = await executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'table-data',
      panelId: 'admin',
      payload: {
        filters: { message: 'rav' },
        intent: 'relation',
        managerId: 'comments',
        ownerId: 'post-1',
        page: 1,
        perPage: 1,
        resourceId: 'posts',
        search: 'brav',
        sort: [{ column: 'body', direction: 'desc' }],
      },
    })

    expect(result.data.relations).toEqual([
      expect.objectContaining({
        hasMore: false,
        id: 'comments',
        page: 1,
        perPage: 1,
        records: [{ id: 'comment-2', values: { body: 'Bravo', id: 'comment-2', postId: 'post-1' } }],
        total: 1,
      }),
    ])
    post.comments.splice(0, post.comments.length, new CommentRecord('comment-1', 'post-1', 'Edited comment'))
  })

  it('applies tenant scope while constructing the relation lookup', async () => {
    post.relationEvents.splice(0)
    const resource = new ResourceBuilder<typeof postModel, PostRecord, PostQuery>(postModel)
      .shared()
      .relations(CommentsRelationManager)

    await executeGeneratedResourceOperation(resource, {
      context: {
        actor: { id: 'admin' },
        scopeTenantQuery: (query) => {
          post.relationEvents.push('scope')
          return query
        },
        signal: new AbortController().signal,
        tenant: { id: 'tenant-1' },
      },
      operation: 'table-data',
      panelId: 'admin',
      payload: { intent: 'relation', managerId: 'comments', ownerId: 'post-1', resourceId: 'posts' },
    })

    expect(post.relationEvents.slice(0, 3)).toEqual(['scope', 'load', 'get'])
  })
})
