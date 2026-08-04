import { column, defineResource, field } from '@holo-js/panels'
import User from '../../../models/User'

const UserResource = defineResource(User)
  .shared()
  .recordTitle('name')
  .routeKey('id')
  .slug('users')
  .navigation({ group: 'Access', icon: 'users', label: 'Users', sort: 70 })
  .globalSearch({ attributes: ['name', 'email'], title: 'name' })
  .form([field.text('name').required(), field.text('email').required()])
  .table([column.text('name'), column.text('email')])

export default UserResource
