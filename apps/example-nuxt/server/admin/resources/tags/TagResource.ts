import { column, defineResource, field } from '@holo-js/panels'
import Tag from '../../../models/Tag'

export default defineResource(Tag, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('name')
  .routeKey('slug')
  .navigation({ group: 'Content', icon: 'tag', label: 'Tags', sort: 30 })
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
