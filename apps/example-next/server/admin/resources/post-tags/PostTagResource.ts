import { column, defineResource, field } from '@holo-js/panels'
import PostTag from '../../../models/PostTag'

export default defineResource(PostTag, { tenant: String })
  .recordTitle('id')
  .routeKey('id')
  .slug('post-tags')
  .navigation({ group: 'Content', icon: 'link', label: 'Post tags', sort: 35 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .form([field.text('postId').required(), field.text('tagId').required()])
  .table([column.text('postId'), column.text('tagId')])
