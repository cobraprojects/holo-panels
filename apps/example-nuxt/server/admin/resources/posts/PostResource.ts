import { column, defineResource, field } from '@holo-js/panels'
import Post from '../../../models/Post'
import { AdminActor } from '../../pages/posts/access'

export default defineResource(Post, { actor: AdminActor, tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ tenantId: context.tenant }))
  .recordTitle('title')
  .routeKey('slug')
  .navigationLabel('Posts')
  .navigationIcon('document-text')
  .globalSearch({ attributes: ['title', 'slug', 'excerpt'], details: ['status', 'categoryId'], title: 'title' })
  .discoverPages()
  .form([
    field.text('title').required(),
    field.text('slug').required(),
    field.text('excerpt').required(),
    field.text('body').required(),
    field.text('status').required(),
    field.text('categoryId').required(),
    field.text('authorId').required(),
    field.text('featuredMediaId'),
    field.text('category').required(),
    field.text('city').required(),
  ])
  .table([
    column.text('title'),
    column.text('slug'),
    column.text('status'),
    column.text('categoryId'),
    column.text('authorId'),
    column.text('category'),
    column.text('city'),
  ])
