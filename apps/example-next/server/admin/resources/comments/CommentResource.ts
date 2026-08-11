import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Comment from '../../../models/Comment'

const form = defineSchema(Comment).fields(field => [
  field.text('postId').required(),
  field.text('authorName').required(),
  field.textarea('body').required(),
  field.select('status').options([
    { label: 'Approved', value: 'approved' },
    { label: 'Pending', value: 'pending' },
    { label: 'Spam', value: 'spam' },
  ]).required(),
])
const table = defineTable(Comment).columns(column => [
  column.text('authorName').searchable(),
  column.text('body').limit(80).wrap(),
  column.text('status').badge(),
])

export default defineResource(Comment)
  .recordTitle('authorName')
  .routeKey('id')
  .slug('comments')
  .navigation({ group: 'Content', icon: 'chat', label: 'Comments', sort: 40 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .discoverPages()
  .form(form)
  .table(table)
