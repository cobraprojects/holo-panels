import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Media from '../../../models/Media'

const form = defineSchema(Media).fields(field => [field.text('alt').required()])
const table = defineTable(Media).columns(column => [
  column.text('alt').searchable(),
  column.text('mime').badge(),
  column.text('size').number(),
])

export default defineResource(Media)
  .slug('media')
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('alt')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'image', label: 'Media', sort: 50 })
  .globalSearch({ attributes: ['alt', 'mime'], title: 'alt' })
  .discoverPages()
  .form(form)
  .table(table)
