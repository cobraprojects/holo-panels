import { csvExportFormat, csvImportFormat, defineExporter, defineImporter } from '@holo-js/panels'
import Post from '../../models/Post'
import PostResource from '../resources/posts/PostResource'

const queue = Object.freeze({ backoff: [1_000, 5_000, 15_000], connection: 'database', queue: 'panels-transfers', tries: 3 })
const retention = Object.freeze({ artifactMilliseconds: 86_400_000, operationMilliseconds: 604_800_000 })
const importStorage = Object.freeze({ directory: 'panels/imports', disk: 'private' })
const exportStorage = Object.freeze({ directory: 'panels/exports', disk: 'private' })

export const PostImporter = defineImporter('post-import', PostResource)
  .label('Import posts')
  .column('title', column => column.required().label('Title'))
  .column('slug', column => column.required().label('Slug'))
  .column('excerpt', column => column.required().label('Excerpt'))
  .column('body', column => column.required().label('Body'))
  .column('status', column => column.required().label('Status'))
  .column('categoryId', column => column.required().label('Category ID'))
  .column('authorId', column => column.required().label('Author ID'))
  .column('featuredMediaId', column => column.label('Featured media ID'))
  .column('category', column => column.required().label('Category'))
  .column('city', column => column.required().label('City'))
  .format(csvImportFormat(), { limits: { maxBytes: 10_485_760, maxCellBytes: 65_536, maxColumns: 10, maxRows: 100_000 } })
  .authorize(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .authorizeCancellation(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .queue(queue)
  .storage(importStorage)
  .retention(retention)
  .mutation({
    async choose(values, context) {
      const record = await Post.query().where('tenantId', context.tenant).where('slug', String(values.slug ?? '')).first()
      return record ? { kind: 'update', record } : { kind: 'create' }
    },
    async create(values, context) {
      const record = Post.make(values)
      record.forceFill({ tenantId: context.tenant })
      return record.save()
    },
    duplicateKey: (values, context) => `${context.tenant}:${String(values.slug ?? '')}`,
    transaction: operation => Post.getRepository().getConnection().transaction(async () => operation()),
    update: (record, values) => record.update(values),
    validate(values) {
      if (!String(values.title ?? '').trim() || !String(values.slug ?? '').trim()) throw new Error('Post title and slug are required.')
    },
  })

export const PostExporter = defineExporter('post-export', PostResource)
  .label('Export posts')
  .column('id', 'id', column => column.label('ID'))
  .column('title', 'title', column => column.label('Title'))
  .column('slug', 'slug', column => column.label('Slug'))
  .column('status', 'status', column => column.label('Status'))
  .column('category', 'category', column => column.label('Category'))
  .column('city', 'city', column => column.label('City'))
  .format(csvExportFormat(), {})
  .authorize(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .authorizeCancellation(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .queue(queue)
  .storage(exportStorage)
  .retention(retention)
  .query({
    primaryKey: 'id',
    applyAggregates: query => query,
    applyAuthorizationScope: query => query,
    applyRelations: query => query,
    applySelection: (query, selection) => selection.mode === 'explicit'
      ? query.whereIn('id', selection.recordIds)
      : query.whereNotIn('id', selection.excludedRecordIds),
    applyTableState: query => query,
    applyTenantScope: (query, context) => query.where('tenantId', context.tenant),
    authorize: context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant),
    count: query => query.count(),
    createQuery: () => Post.query(),
    fetchChunk: (query, offset, limit) => query.offset(offset).limit(limit).get(),
    orderBy: query => query.orderBy('id', 'asc'),
  })
