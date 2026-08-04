import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import Tag from '../../../models/Tag'
import { defineDomainResourcePages } from '../../pages/domain'

export const TagPages = defineDomainResourcePages({ label: 'Tags', resourceId: 'tags', sort: 30 })

export default defineResource(Tag, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'tag', label: 'Tags', sort: 30 })
  .globalSearch({ attributes: ['name', 'slug'], title: 'name' })
  .pages(TagPages.list, TagPages.create, TagPages.view, TagPages.edit)
  .form([field.text('name').required(), field.text('slug').required()])
  .infolist(defineSchema(Tag).fields([column.text('name'), column.text('slug')]))
  .table([column.text('name'), column.text('slug')])
