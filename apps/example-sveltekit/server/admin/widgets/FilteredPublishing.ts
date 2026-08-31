import { defineStatsWidget } from '@holo-js/panels'
import Post from '../../models/Post'

export default defineStatsWidget('filtered-publishing')
  .heading('Filtered publishing')
  .columnSpan('full')
  .lazy()
  .data(async context => {
    const posts = await Post.query().where('tenantId', context.tenant).get()
    const search = String(context.filters.search ?? '').toLocaleLowerCase()
    const filtered = posts.filter(post => post.title.toLocaleLowerCase().includes(search))
    return { stats: [{
      action: null,
      chart: [0, posts.length, filtered.length],
      color: 'success',
      description: search ? `Matching ${search}` : 'All tenant posts',
      icon: 'document-text',
      id: 'matching-posts',
      label: 'Matching posts',
      progress: { value: filtered.length, max: Math.max(1, posts.length) },
      trend: 'neutral',
      url: '/admin/posts',
      value: filtered.length,
    }] }
  })
