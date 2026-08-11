import { defineResource, defineSchema, defineTable } from '@holo-js/panels'
import User from '../../../models/User'

const form = defineSchema(User).fields(field => [field.text('name').required(), field.text('email').email().required()])
const table = defineTable(User).columns(column => [column.text('name').searchable(), column.text('email').copyable()])

const UserResource = defineResource(User)
  .shared()
  .recordTitle('name')
  .routeKey('id')
  .slug('users')
  .navigation({ group: 'Access', icon: 'users', label: 'Users', sort: 70 })
  .globalSearch({ attributes: ['name', 'email'], title: 'name' })
  .discoverPages()
  .form(form)
  .table(table)

export default UserResource
