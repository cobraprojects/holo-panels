import { column, defineResource, field } from '@holo-js/panels'
import User from '../../../models/User'

export default defineResource(User)
  .shared()
  .createBindings(() => ({ id: crypto.randomUUID() }))
  .recordTitle('name')
  .routeKey('id')
  .navigation({ group: 'Access', icon: 'users', label: 'Users', sort: 50 })
  .globalSearch({ attributes: ['name', 'email'], title: 'name' })
  .discoverPages()
  .form([
    field.text('name').required(),
    field.text('email').required(),
  ])
  .table([
    column.text('name'),
    column.text('email'),
  ])
