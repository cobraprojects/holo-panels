import { defineCustomPage } from '@holo-js/panels'
import { ExampleAdminActor } from '../access'

export default defineCustomPage('overview', {
  actor: ExampleAdminActor,
  load: context => ({ tenantId: context.actor.tenantId }),
})
  .path('/admin')
  .authorize(context => context.actor.canManagePosts === true)
  .title('Overview')
  .heading('Holo Panels')
  .navigation({ label: 'Overview', sort: 1 })
