import { column, defineResource, field } from '@holo-js/panels'
import Category from '../../../models/Category'

export default defineResource(Category, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'folder', label: 'Categories', sort: 20 })
  .globalSearch({ attributes: ['name', 'slug'], title: 'name' })
  .discoverPages()
  .form([
    field.text('name').required(),
    field.text('slug').required(),
  ])
  .table([
    column.text('name'),
    column.text('slug'),
  ])
