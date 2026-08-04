import { defineCustomPage } from '@holo-js/panels'
import { AdminActor, canManagePosts } from './posts/access'

export default defineCustomPage('overview', { actor: AdminActor, load: () => ({}) })
  .path('/admin')
  .authorize(context => canManagePosts(context.actor))
  .title('Overview')
  .heading('Holo Panels overview')
  .navigation({ icon: 'home', label: 'Overview', sort: 1 })
