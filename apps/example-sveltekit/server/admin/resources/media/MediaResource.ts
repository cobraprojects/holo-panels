import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import Media from '../../../models/Media'
import { defineDomainResourcePages } from '../../pages/domain'

export const MediaPages = defineDomainResourcePages({ label: 'Media', mutations: false, resourceId: 'media', sort: 50 })

export default defineResource(Media, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .configured('media', resource => resource
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('alt')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'image', label: 'Media', sort: 50 })
  .globalSearch({ attributes: ['alt'], details: ['mime'], title: 'alt' })
  .pages(MediaPages.list, MediaPages.view)
  .form([field.text('alt').required()])
  .infolist(defineSchema(Media).fields([
    column.text('alt'),
    column.text('mime'),
    column.number('size'),
  ]))
  .table([
    column.text('alt'),
    column.text('mime'),
    column.number('size'),
  ]))
