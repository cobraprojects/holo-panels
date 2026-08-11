import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Tag from '../../../models/Tag'

const form = defineSchema(Tag).fields(field => [field.text('name').required(), field.slug('slug').from('name').required()])
const table = defineTable(Tag).columns(column => [column.text('name').searchable(), column.text('slug')])

export default defineResource(Tag)
  .recordTitle('name')
  .routeKey('id')
  .slug('tags')
  .navigation({ group: 'Content', icon: 'tag', label: 'Tags', sort: 30 })
  .globalSearch({ attributes: ['name', 'slug'], limit: 10, title: 'name' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .discoverPages()
  .form(form)
  .table(table)
