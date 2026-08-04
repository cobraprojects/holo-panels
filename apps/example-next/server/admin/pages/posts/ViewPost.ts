import { defineViewPage } from '@holo-js/panels'
import { AdminActor, canManagePosts, postResourceProperties } from './access'

export default defineViewPage('posts-view', {
  actor: AdminActor,
  load: async (context) => {
    const { loadPostRecord, postExecutionContext } = await import('./data')
    return {
      operation: 'view',
      record: await loadPostRecord(context.parameters.record ?? '', postExecutionContext(context.actor, context.signal, context.tenant)),
      resourceId: 'posts',
    }
  },
  tenant: String,
})
  .path('/admin/posts/:record')
  .authorize(context => canManagePosts(context.actor))
  .title(context => `Post ${context.parameters.record ?? ''}`.trim())
  .heading('View post')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .headerActions('edit-post')
  .footerActions('delete-post')
  .body('resource-page', { ...postResourceProperties, operation: 'view' })
