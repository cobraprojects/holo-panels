import { column, defineResource, field } from '@holo-js/panels'
import Comment from '../../../models/Comment'

export default defineResource(Comment, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('authorName')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'chat-bubble-left', label: 'Comments', sort: 40 })
  .globalSearch({ attributes: ['authorName', 'body'], details: ['status'], title: 'authorName' })
  .discoverPages()
  .form([
    field.text('postId').required(),
    field.text('authorName').required(),
    field.text('body').required(),
    field.text('status').required(),
  ])
  .table([
    column.text('authorName'),
    column.text('body'),
    column.text('status'),
  ])
