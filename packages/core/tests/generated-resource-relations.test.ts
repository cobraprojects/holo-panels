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

  constructor(readonly id: string, readonly title: string) {}

  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  getRelation(name: string): unknown { return name === 'comments' ? this.comments : undefined }
  async load(): Promise<this> { return this }
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
        Object.freeze({ id: 'edit', kind: 'edit', visible: true }),
        Object.freeze({ id: 'delete', kind: 'delete', visible: true }),
      ]),
      id: 'comments',
      kind: 'relation-manager',
      relationName: 'comments',
      table: Object.freeze({
        compile: () => Object.freeze({
          columns: Object.freeze([
            Object.freeze({ label: 'Message', path: 'body' }),
          ]),
        }),
      }),
    })
  }
}

describe('generated resource relation managers', () => {
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
        columns: [{ key: 'body', label: 'Message' }],
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
})
