import { defineCreatePage } from '@holo-js/panels'
import { ExampleAdminActor } from '../../access'

export default defineCreatePage('posts.create', { actor: ExampleAdminActor, load: () => ({ mode: 'create' }) })
  .path('/admin/posts/create')
  .authorize(context => context.actor.canManagePosts === true)
  .title('Create post')
  .heading('Create post')
  .breadcrumbs([
    { label: 'Posts', path: '/admin/posts' },
    { label: 'Create', path: '/admin/posts/create' },
  ])
