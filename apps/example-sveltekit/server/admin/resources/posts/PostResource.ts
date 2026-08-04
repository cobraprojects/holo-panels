import { column, defineResource, field } from '@holo-js/panels'
import Post from '../../../models/Post'
import { ExampleAdminActor } from '../../access'
import CreatePost from '../../pages/posts/CreatePost'
import EditPost from '../../pages/posts/EditPost'
import ListPosts from '../../pages/posts/ListPosts'
import ViewPost from '../../pages/posts/ViewPost'

export default defineResource(Post, { actor: ExampleAdminActor, tenant: String })
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
  .recordTitle('title')
  .routeKey('slug')
  .navigation({ icon: 'document', label: 'Posts', sort: 10 })
  .globalSearch({ attributes: ['title', 'slug'], details: ['category', 'city'], title: 'title' })
  .pages(ListPosts, CreatePost, ViewPost, EditPost)
  .form([
    field.text('title').required(),
    field.text('slug').required(),
    field.text('category').required(),
    field.text('city').required(),
  ])
  .table([
    column.text('title'),
    column.text('slug'),
    column.text('category'),
    column.text('city'),
  ])
