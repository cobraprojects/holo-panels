import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Category from '../../../models/Category'

const form = defineSchema(Category).fields(field => [field.text('name').required(), field.text('slug').required()])
const table = defineTable(Category).columns(column => [column.text('name'), column.text('slug')])

export default defineResource(Category)
  .recordTitle('name')
  .routeKey('id')
  .slug('categories')
  .navigation({ group: 'Content', icon: 'folder', label: 'Categories', sort: 20 })
  .globalSearch({ attributes: ['name', 'slug'], limit: 10, title: 'name' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .discoverPages()
  .form(form)
  .table(table)
