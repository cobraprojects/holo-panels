import { column, defineResource, field } from '@holo-js/panels'
import Membership from '../../../models/Membership'

export default defineResource(Membership, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('userId')
  .routeKey('id')
  .navigation({ group: 'Access', icon: 'key', label: 'Memberships', sort: 60 })
  .discoverPages()
  .form([
    field.text('userId').required(),
    field.text('roleKey').required(),
  ])
  .table([
    column.text('userId'),
    column.text('roleKey'),
  ])
