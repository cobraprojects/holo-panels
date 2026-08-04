import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import Membership from '../../../models/Membership'
import { defineDomainResourcePages } from '../../pages/domain'

export const MembershipPages = defineDomainResourcePages({ label: 'Memberships', mutations: false, resourceId: 'memberships', sort: 60 })

export default defineResource(Membership, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .recordTitle('userId')
  .routeKey('id')
  .navigation({ group: 'Access', icon: 'key', label: 'Memberships', sort: 60 })
  .globalSearch({ attributes: ['userId', 'roleKey'], title: 'userId' })
  .pages(MembershipPages.list, MembershipPages.view)
  .form([field.text('userId').required(), field.text('roleKey').required()])
  .infolist(defineSchema(Membership).fields([column.text('userId'), column.text('roleKey')]))
  .table([column.text('userId'), column.text('roleKey')])
