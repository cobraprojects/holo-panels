import { defineChartWidget } from '@holo-js/panels'
import Post from '../../models/Post'

export default defineChartWidget('publishing-chart')
  .heading('Publishing chart')
  .data(async context => {
    const posts = await Post.query().where('tenantId', context.tenant).get()
    const search = String(context.filters.search ?? '').toLocaleLowerCase()
    const filtered = posts.filter(post => post.title.toLocaleLowerCase().includes(search))
    return {
      description: 'Posts matching the dashboard search within the active tenant',
      series: [{ color: 'primary', id: 'posts', label: 'Posts', points: [{ label: 'All', value: posts.length }, { label: 'Matching', value: filtered.length }] }],
      summary: 'Publishing totals',
      type: 'bar',
    }
  })
