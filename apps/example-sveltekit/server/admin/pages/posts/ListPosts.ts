import { defineListPage } from '@holo-js/panels'
import { ExampleAdminActor } from '../../access'

export default defineListPage('posts.list', { actor: ExampleAdminActor, load: () => ({ filters: { search: '' }, records: [] }) })
  .path('/admin/posts')
  .authorize(context => context.actor.canManagePosts === true)
  .title('Posts')
  .heading('Posts')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .headerActions('posts.create')
  .navigation({ label: 'Posts', sort: 10 })
