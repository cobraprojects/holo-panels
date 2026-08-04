import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import User from '../../../models/User'
import { defineDomainResourcePages } from '../../pages/domain'

export const UserPages = defineDomainResourcePages({ label: 'Users', mutations: false, resourceId: 'users', sort: 70 })

export default defineResource(User)
  .shared()
  .recordTitle('name')
  .routeKey('id')
  .navigation({ group: 'Access', icon: 'users', label: 'Users', sort: 70 })
  .globalSearch({ attributes: ['name', 'email'], title: 'name' })
  .pages(UserPages.list, UserPages.view)
  .form([field.text('name').required(), field.text('email').required()])
  .infolist(defineSchema(User).fields([column.text('name'), column.text('email')]))
  .table([column.text('name'), column.text('email')])
