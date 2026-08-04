import { defineResource } from '@holo-js/panels'
import Post from '../../../models/Post'
import { AdminActor } from '../../pages/posts/access'
import { postFormSchema, postResourceMetadata, postTableSchema } from './schema'

export default defineResource(Post, { actor: AdminActor, tenant: String })
  .recordTitle(postResourceMetadata.recordTitle)
  .routeKey(postResourceMetadata.routeKey)
  .slug(postResourceMetadata.slug)
  .navigation({ icon: 'document-text', label: 'Posts', sort: 10 })
  .globalSearch({ attributes: ['title', 'slug'], details: ['category', 'city'], limit: 10, title: 'title' })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings((context) => {
    if (!context.actor) throw new Error('An authenticated actor is required to create a post.')
    return {
      authorId: String(context.actor.id),
      body: 'Created through Holo Panels.',
      categoryId: `category-${context.tenant.replace(/^tenant-/u, '')}-guides`,
      excerpt: 'Created through Holo Panels.',
      status: 'draft',
      tenantId: context.tenant,
    }
  })
  .form(postFormSchema)
  .table(postTableSchema)
