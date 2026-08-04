import { column, defineResource, field } from '@holo-js/panels'
import Comment from '../../../models/Comment'

export default defineResource(Comment, { tenant: String })
  .recordTitle('authorName')
  .routeKey('id')
  .slug('comments')
  .navigation({ icon: 'chat-bubble-left-right', label: 'Comments', sort: 40 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
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
