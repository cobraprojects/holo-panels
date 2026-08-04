import { defineListPage } from '@holo-js/panels'
import { AdminActor, canManagePosts } from './access'

export default defineListPage('posts', { actor: AdminActor, load: () => ({ operation: 'list', resourceId: 'posts' }) })
  .path('/admin/posts')
  .authorize(context => canManagePosts(context.actor))
  .title('Posts')
  .heading('Manage posts')
  .navigation({ icon: 'document-text', label: 'Posts', sort: 10 })
  .headerActions('create-post')
  .body('resource-page', { operation: 'list', resourceId: 'posts' })
