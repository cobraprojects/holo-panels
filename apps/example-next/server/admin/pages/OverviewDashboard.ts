import { defineCustomPage } from '@holo-js/panels'

export default defineCustomPage('overview')
  .loader(() => ({}))
  .path('/admin')
  .title('Overview')
  .heading('Content overview')
  .subheading('Tenant-scoped publishing and moderation totals')
  .navigation({ icon: 'home', label: 'Overview', sort: 1 })
  .headerWidgets('content-overview')
  .authorize(context => context.actor.tenantId === context.tenant || context.actor.role === 'super-admin')
