import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Tag from '../../../models/Tag'

const form = defineSchema(Tag).fields(field => [field.text('name').required(), field.slug('slug').from('name').required()])
const table = defineTable(Tag).columns(column => [column.text('name').searchable(), column.text('slug')])

export default defineResource(Tag)
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'tag', label: 'Tags', sort: 30 })
  .globalSearch({ attributes: ['name', 'slug'], title: 'name' })
  .discoverPages()
  .form(form)
  .table(table)
