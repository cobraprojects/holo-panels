import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Category from '../../../models/Category'

const form = defineSchema(Category).fields(field => [field.text('name').required(), field.slug('slug').from('name').required()])
const table = defineTable(Category).columns(column => [column.text('name').searchable(), column.text('slug')])

export default defineResource(Category)
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'folder', label: 'Categories', sort: 20 })
  .globalSearch({ attributes: ['name', 'slug'], title: 'name' })
  .discoverPages()
  .form(form)
  .table(table)
