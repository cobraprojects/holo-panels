import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import Comment from '../../../models/Comment'
import { defineDomainResourcePages } from '../../pages/domain'

export const CommentPages = defineDomainResourcePages({ label: 'Comments', resourceId: 'comments', sort: 40 })

export default defineResource(Comment, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('authorName')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'chat', label: 'Comments', sort: 40 })
  .globalSearch({ attributes: ['authorName', 'body'], details: ['status'], title: 'authorName' })
  .pages(CommentPages.list, CommentPages.create, CommentPages.view, CommentPages.edit)
  .form([
    field.text('postId').required(),
    field.text('authorName').required(),
    field.text('body').required(),
    field.text('status').required(),
  ])
  .infolist(defineSchema(Comment).fields([
    column.text('authorName'),
    column.text('body'),
    column.text('status'),
  ]))
  .table([
    column.text('authorName'),
    column.text('postId'),
    column.text('status'),
  ])
