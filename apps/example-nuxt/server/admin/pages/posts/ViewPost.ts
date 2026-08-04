import { defineViewPage } from '@holo-js/panels'
import { AdminActor, canManagePosts } from './access'

export default defineViewPage('posts-view', {
  actor: AdminActor,
  load: context => ({ operation: 'view', recordId: context.parameters.record ?? '', resourceId: 'posts' }),
})
  .path('/admin/posts/:record')
  .authorize(context => canManagePosts(context.actor))
  .title(context => `Post ${context.parameters.record ?? ''}`.trim())
  .heading('View post')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .headerActions('edit-post')
  .footerActions('delete-post')
  .body('resource-page', { operation: 'view', resourceId: 'posts' })
