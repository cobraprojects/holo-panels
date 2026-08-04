import { column, defineResource, field } from '@holo-js/panels'
import Tag from '../../../models/Tag'

export default defineResource(Tag, { tenant: String })
  .recordTitle('name')
  .routeKey('id')
  .slug('tags')
  .navigation({ icon: 'tag', label: 'Tags', sort: 30 })
  .globalSearch({ attributes: ['name', 'slug'], limit: 10, title: 'name' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .form([field.text('name').required(), field.text('slug').required()])
  .table([column.text('name'), column.text('slug')])
