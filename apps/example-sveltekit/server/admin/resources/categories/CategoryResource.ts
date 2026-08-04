import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import Category from '../../../models/Category'
import { defineDomainResourcePages } from '../../pages/domain'

export const CategoryPages = defineDomainResourcePages({ label: 'Categories', resourceId: 'categories', sort: 20 })

export default defineResource(Category, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'folder', label: 'Categories', sort: 20 })
  .globalSearch({ attributes: ['name', 'slug'], title: 'name' })
  .pages(CategoryPages.list, CategoryPages.create, CategoryPages.view, CategoryPages.edit)
  .form([field.text('name').required(), field.text('slug').required()])
  .infolist(defineSchema(Category).fields([column.text('name'), column.text('slug')]))
  .table([column.text('name'), column.text('slug')])
