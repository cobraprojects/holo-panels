import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Media from '../../../models/Media'

const form = defineSchema(Media).fields(field => [field.text('alt').required()])
const table = defineTable(Media).columns(column => [
  column.text('alt').searchable(),
  column.text('mime').badge(),
  column.text('size').number(),
])

export default defineResource(Media).configured('media', resource => resource)
  .recordTitle('alt')
  .routeKey('id')
  .slug('media')
  .navigation({ group: 'Content', icon: 'image', label: 'Media', sort: 50 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .writableAttributes(['alt'])
  .discoverPages()
  .form(form)
  .table(table)
