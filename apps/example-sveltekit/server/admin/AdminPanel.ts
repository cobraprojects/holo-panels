import { definePanel } from '@holo-js/panels'
import Tenant from '../models/Tenant'
import User from '../models/User'

export default definePanel(User)
  .id('admin')
  .path('/admin')
  .default()
  .login()
  .profile()
  .multiFactorAuthentication()
  .tenant(Tenant)
  .access(({ actor }) => actor !== null && ['editor', 'super-admin', 'tenant-admin'].includes(actor.roleKey))
  .brandName('Holo Panels')
  .colors({ primary: '#7c3aed' })
  .databaseNotifications({ realtime: true })
