import { defineCustomPage } from '@holo-js/panels'

export default defineCustomPage('content-dashboard')
  .loader(() => ({}))
  .path('/admin')
  .authorize(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .title('Content overview')
  .heading('Content overview')
  .subheading('Publishing and moderation activity for the active tenant')
  .breadcrumbs([{ label: 'Overview', path: '/admin' }])
  .headerWidgets('content-overview')
  .navigation({ icon: 'home', label: 'Overview', sort: 1 })
