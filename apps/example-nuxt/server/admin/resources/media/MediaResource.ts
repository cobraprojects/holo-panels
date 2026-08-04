import { column, defineResource, field } from '@holo-js/panels'
import Media from '../../../models/Media'

export default defineResource(Media, { tenant: String })
  .slug('media')
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('alt')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'photo', label: 'Media', sort: 45 })
  .globalSearch({ attributes: ['alt', 'mime'], title: 'alt' })
  .discoverPages()
  .form([
    field.text('alt').required(),
  ])
  .table([
    column.text('alt'),
    column.text('mime'),
    column.number('size'),
  ])
