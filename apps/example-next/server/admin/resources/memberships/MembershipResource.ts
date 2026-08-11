import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import Membership from '../../../models/Membership'

const form = defineSchema(Membership).fields(field => [field.text('userId').required(), field.text('roleKey').required()])
const table = defineTable(Membership).columns(column => [column.text('userId'), column.text('roleKey').badge()])

export default defineResource(Membership)
  .recordTitle('userId')
  .routeKey('id')
  .slug('memberships')
  .navigation({ group: 'Access', icon: 'key', label: 'Memberships', sort: 60 })
  .globalSearch({ attributes: ['userId', 'roleKey'], title: 'userId' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .discoverPages()
  .form(form)
  .table(table)
