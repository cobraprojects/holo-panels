import { defineEditPage } from '@holo-js/panels'
import { ExampleAdminActor } from '../../access'

export default defineEditPage('posts.edit', { actor: ExampleAdminActor, load: context => ({ recordId: context.parameters.record ?? '' }) })
  .path('/admin/posts/:record/edit')
  .authorize(context => context.actor.canManagePosts === true)
  .title('Edit post')
  .heading('Edit post')
  .breadcrumbs(context => [
    { label: 'Posts', path: '/admin/posts' },
    { label: 'Edit', path: `/admin/posts/${context.parameters.record}/edit` },
  ])
  .headerActions('posts.delete')
