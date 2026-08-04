import { defineViewPage } from '@holo-js/panels'
import { ExampleAdminActor } from '../../access'

export default defineViewPage('posts.view', { actor: ExampleAdminActor, load: context => ({ recordId: context.parameters.record ?? '' }) })
  .path('/admin/posts/:record')
  .authorize(context => context.actor.canManagePosts === true)
  .title('View post')
  .heading('Post details')
  .breadcrumbs(context => [
    { label: 'Posts', path: '/admin/posts' },
    { label: 'View', path: `/admin/posts/${context.parameters.record}` },
  ])
  .headerActions('posts.edit', 'posts.delete')
