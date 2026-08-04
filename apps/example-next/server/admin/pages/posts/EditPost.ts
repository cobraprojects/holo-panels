import { defineEditPage } from '@holo-js/panels'
import { AdminActor, canManagePosts, postResourceProperties } from './access'

export default defineEditPage('posts-edit', {
  actor: AdminActor,
  load: async (context) => {
    const { loadPostRecord, postExecutionContext } = await import('./data')
    return {
      operation: 'edit',
      record: await loadPostRecord(context.parameters.record ?? '', postExecutionContext(context.actor, context.signal, context.tenant)),
      resourceId: 'posts',
    }
  },
  tenant: String,
})
  .path('/admin/posts/:record/edit')
  .authorize(context => canManagePosts(context.actor))
  .title(context => `Edit post ${context.parameters.record ?? ''}`.trim())
  .heading('Edit post')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .footerActions('delete-post')
  .body('resource-page', { ...postResourceProperties, operation: 'edit' })
