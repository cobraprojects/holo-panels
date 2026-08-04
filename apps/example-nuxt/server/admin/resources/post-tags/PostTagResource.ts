import { column, defineResource, field } from '@holo-js/panels'
import PostTag from '../../../models/PostTag'

export default defineResource(PostTag, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('postId')
  .routeKey('id')
  .form([
    field.text('postId').required(),
    field.text('tagId').required(),
  ])
  .table([
    column.text('postId'),
    column.text('tagId'),
  ])
