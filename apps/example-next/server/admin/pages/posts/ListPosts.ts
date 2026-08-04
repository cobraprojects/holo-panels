import { defineListPage } from '@holo-js/panels'
import { AdminActor, canManagePosts, postResourceProperties } from './access'

export default defineListPage('posts', {
  actor: AdminActor,
  load: async (context) => {
    const { loadPostRecords, postExecutionContext } = await import('./data')
    return {
      operation: 'list',
      records: await loadPostRecords(postExecutionContext(context.actor, context.signal, context.tenant)),
      resourceId: 'posts',
    }
  },
  tenant: String,
})
  .path('/admin/posts')
  .authorize(context => canManagePosts(context.actor))
  .title('Posts')
  .heading('Manage posts')
  .navigation({ icon: 'document-text', label: 'Posts', sort: 10 })
  .headerActions('create-post')
  .body('resource-page', { ...postResourceProperties, operation: 'list' })
