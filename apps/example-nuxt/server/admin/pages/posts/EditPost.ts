import { defineEditPage } from '@holo-js/panels'
import { AdminActor, canManagePosts } from './access'

export default defineEditPage('posts-edit', {
  actor: AdminActor,
  load: context => ({ operation: 'edit', recordId: context.parameters.record ?? '', resourceId: 'posts' }),
})
  .path('/admin/posts/:record/edit')
  .authorize(context => canManagePosts(context.actor))
  .title(context => `Edit post ${context.parameters.record ?? ''}`.trim())
  .heading('Edit post')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .footerActions('delete-post')
  .body('resource-page', { operation: 'edit', resourceId: 'posts' })
