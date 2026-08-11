import { defineRelationManager, defineResource, defineResourceStatsWidget, defineSchema, defineTable, entriesFor } from '@holo-js/panels'
import Post from '../../../models/Post'

const form = defineSchema(Post).fields(field => [
  field.text('title').required(),
  field.slug('slug').from('title').required(),
  field.radio('category').options([
    { label: 'News', value: 'News' },
    { label: 'Guides', value: 'Guides' },
  ]).required(),
  field.select('city').options([
    { label: 'Alexandria', value: 'Alexandria' },
    { label: 'Cairo', value: 'Cairo' },
    { label: 'Giza', value: 'Giza' },
  ]).required(),
  field.file('featuredMediaId', {
    acceptedExtensions: ['jpg', 'jpeg', 'png', 'webp'],
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    directory: 'panels/uploads/posts',
    disk: 'private',
    expiresInSeconds: 900,
    imageOnly: true,
    maximumFiles: 1,
    maximumSize: 5_242_880,
    private: true,
  }),
])
const table = defineTable(Post)
  .columns(column => [
    column.text('title').searchable().sortable(),
    column.text('slug').copyable(),
    column.text('category').badge(),
    column.text('city'),
    column.text('author.name').label('Author'),
  ])
  .filters(filter => [
    filter.select('category', 'category').label('Category').options([{ label: 'News', value: 'News' }, { label: 'Guides', value: 'Guides' }]),
    filter.select('city', 'city').label('City').options([{ label: 'Alexandria', value: 'Alexandria' }, { label: 'Cairo', value: 'Cairo' }, { label: 'Giza', value: 'Giza' }]),
  ])
  .deferFilters()
  .groups(group => [group.group('category', 'category').label('Category').collapsible()])
  .summaries(summary => [summary.count('posts-count').label('Posts')])
const infolist = entriesFor(Post)
const activeQuery = defineResourceStatsWidget('active-query', { record: Post })
  .heading('Active query')
  .columnSpan('full')
  .data(context => ({
    stats: [{
      action: null,
      chart: [],
      color: 'primary',
      description: `Search: ${context.resource?.tableState?.search ?? ''}`,
      icon: 'search',
      id: 'search',
      label: 'Search',
      trend: null,
      url: null,
      value: context.resource?.tableState?.search || 'All records',
    }],
  }))

export default defineResource(Post)
  .actions(action => [
    action.action('publish-selected')
      .label('Publish selected')
      .icon('check')
      .mount('bulk')
      .requiresConfirmation('Publish the selected posts?')
      .authorize(() => true)
      .action(async (_input, context) => {
        if (!context.record) throw new Error('A selected post is required.')
        const post = await Post.where('id', context.record.id).first()
        if (!post) throw new Error('The selected post no longer exists.')
        await post.update({ status: 'published' })
        return { id: context.record.id, published: true }
      }),
  ])
  .recordTitle('title')
  .routeKey('id')
  .slug('posts')
  .navigation({ icon: 'document', label: 'Posts', sort: 10 })
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
  .discoverPages()
  .form(form)
  .infolist([infolist.text('title').label('Title'), infolist.text('slug').label('Slug').copyable(), infolist.text('category').label('Category').badge(), infolist.text('city').label('City')])
  .relations(defineRelationManager('comments', Post), defineRelationManager('tags', Post))
  .table(table)
  .widgets(activeQuery)
