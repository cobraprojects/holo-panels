import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import PostTag from '../../../models/PostTag'

const form = defineSchema(PostTag).fields(field => [field.text('postId').required(), field.text('tagId').required()])
const table = defineTable(PostTag).columns(column => [column.text('postId'), column.text('tagId')])

export default defineResource(PostTag)
  .recordTitle('id')
  .routeKey('id')
  .slug('post-tags')
  .navigation({ group: 'Content', icon: 'link', label: 'Post tags', sort: 35 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .discoverPages()
  .form(form)
  .table(table)
