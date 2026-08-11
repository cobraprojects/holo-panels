import { defineCustomPage } from '@holo-js/panels'

export default defineCustomPage('overview')
  .loader(() => ({}))
  .path('/admin')
  .authorize(context => ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(context.actor.role))
  .title('Overview')
  .heading('Holo Panels overview')
  .headerWidgets('content-overview')
  .navigation({ icon: 'home', label: 'Overview', sort: 1 })
