import { column, defineResource, field } from '@holo-js/panels'
import Membership from '../../../models/Membership'

export default defineResource(Membership, { tenant: String })
  .recordTitle('userId')
  .routeKey('id')
  .slug('memberships')
  .navigation({ group: 'Access', icon: 'key', label: 'Memberships', sort: 60 })
  .globalSearch({ attributes: ['userId', 'roleKey'], title: 'userId' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .form([field.text('userId').required(), field.text('roleKey').required()])
  .table([column.text('userId'), column.text('roleKey')])
