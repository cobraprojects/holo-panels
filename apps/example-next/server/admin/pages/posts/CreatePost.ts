import { defineCreatePage } from '@holo-js/panels'
import { AdminActor, canManagePosts, postResourceProperties } from './access'

export default defineCreatePage('posts-create', { actor: AdminActor, load: () => ({ operation: 'create', resourceId: 'posts' }), tenant: String })
  .path('/admin/posts/create')
  .authorize(context => canManagePosts(context.actor))
  .title('Create post')
  .heading('Create post')
  .breadcrumbs([{ label: 'Posts', path: '/admin/posts' }])
  .body('resource-page', { ...postResourceProperties, operation: 'create' })
