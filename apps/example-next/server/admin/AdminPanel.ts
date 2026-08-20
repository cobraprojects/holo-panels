import { definePanel } from '@holo-js/panels'
import User from '../models/User'
import Tenant from '../models/Tenant'
export default definePanel(User)
  .id('admin')
  .default()
  .path('/admin')
  .login()
  .profile()
  .multiFactorAuthentication()
  .tenant(Tenant)
  .access(context => ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(context.actor.role))
  .databaseNotifications({ realtime: true })
  .brandName('Holo Panels Admin')
  .colors({ primary: '#7c3aed' })
