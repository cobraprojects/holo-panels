import { defineStatsWidget } from '@holo-js/panels'
import {
  exampleComments,
  examplePosts,
  recordsForTenant,
} from '../../fixtures/example-domain'

export default defineStatsWidget('content-overview')
  .heading('Content overview')
  .description('Tenant-scoped publishing and moderation totals')
  .columnSpan('full')
  .poll(30_000)
  .authorize(context => ['editor', 'super-admin', 'tenant-admin'].includes(String(context.actor.roleKey)) && (context.actor.roleKey === 'super-admin' || context.actor.tenantId === context.tenant))
  .data(context => {
    const posts = recordsForTenant(examplePosts, context.tenant)
    const comments = recordsForTenant(exampleComments, context.tenant)
    return {
      stats: [
        { action: null, chart: [], color: 'primary', description: 'All tenant posts', icon: 'document', id: 'posts', label: 'Posts', trend: null, url: '/admin/posts', value: posts.length },
        { action: null, chart: [], color: 'success', description: 'Visible on the public blog', icon: 'eye', id: 'published', label: 'Published', trend: null, url: '/blog', value: posts.filter(post => post.status === 'published').length },
        { action: null, chart: [], color: 'warning', description: 'Awaiting moderation', icon: 'chat', id: 'pending-comments', label: 'Pending comments', trend: null, url: '/admin/comments', value: comments.filter(comment => comment.status === 'pending').length },
      ],
    }
  })
