import { column, defineResource, defineSchema, field } from '@holo-js/panels'
import PostTag from '../../../models/PostTag'
import { defineDomainResourcePages } from '../../pages/domain'

export const PostTagPages = defineDomainResourcePages({ label: 'Post tags', resourceId: 'post-tags', sort: 35 })

export default defineResource(PostTag, { tenant: String })
  .tenantScope((query, context) => query.where('tenantId', context.tenant))
  .createBindings(context => ({ id: crypto.randomUUID(), tenantId: context.tenant }))
  .recordTitle('id')
  .routeKey('id')
  .navigation({ group: 'Content', icon: 'link', label: 'Post tags', sort: 35 })
  .pages(PostTagPages.list, PostTagPages.create, PostTagPages.view, PostTagPages.edit)
  .form([field.text('postId').required(), field.text('tagId').required()])
  .infolist(defineSchema(PostTag).fields([column.text('postId'), column.text('tagId')]))
  .table([column.text('postId'), column.text('tagId')])
