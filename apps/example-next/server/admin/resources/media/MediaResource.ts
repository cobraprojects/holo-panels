import { column, defineResource, field } from '@holo-js/panels'
import Media from '../../../models/Media'

export default defineResource(Media, { tenant: String }).configured('media', resource => resource)
  .recordTitle('alt')
  .routeKey('id')
  .slug('media')
  .navigation({ icon: 'photo', label: 'Media', sort: 50 })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .writableAttributes(['alt'])
  .form([field.text('alt').required()])
  .table([
    column.text('alt'),
    column.text('mime'),
    column.number('size'),
  ])
