import { column, defineResource, field } from '@holo-js/panels'
import Category from '../../../models/Category'

export default defineResource(Category, { tenant: String })
  .recordTitle('name')
  .routeKey('id')
  .slug('categories')
  .navigation({ icon: 'folder', label: 'Categories', sort: 20 })
  .globalSearch({ attributes: ['name', 'slug'], limit: 10, title: 'name' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .form([field.text('name').required(), field.text('slug').required()])
  .table([column.text('name'), column.text('slug')])
