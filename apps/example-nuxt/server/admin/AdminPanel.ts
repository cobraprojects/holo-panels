import { definePanel } from '@holo-js/panels'
import Tenant from '../models/Tenant'
import User from '../models/User'

export default definePanel(User)
  .id('admin')
  .path('/admin')
  .login()
  .profile()
  .multiFactorAuthentication()
  .tenant(Tenant)
  .default()
  .access(context => ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(context.actor.role))
  .databaseNotifications({ realtime: true })
  .brandName('Holo Panels Admin')
  .colors({ primary: '#7c3aed' })
  .discoverResources()
  .discoverPages()
  .discoverWidgets()
