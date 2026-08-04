import { defineCustomPage } from '@holo-js/panels'
import { canAccessTenant, canBootstrapAdmin, ExampleAdminActor } from '../access'
import { resolveContentOverview } from '../widgets/ContentOverview'

export default defineCustomPage('content-dashboard', {
  actor: ExampleAdminActor,
  load: context => resolveContentOverview(context.actor, context.tenant, context.signal),
  tenant: String,
})
  .path('/admin')
  .authorize(context => canBootstrapAdmin(context.actor) && canAccessTenant(context.actor, context.tenant))
  .title('Content overview')
  .heading('Content overview')
  .subheading('Publishing and moderation activity for the active tenant')
  .breadcrumbs([{ label: 'Overview', path: '/admin' }])
  .headerWidgets('content-overview')
  .navigation({ icon: 'home', label: 'Overview', sort: 0 })
