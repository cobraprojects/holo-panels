import { defineStatsWidget } from '@holo-js/panels'
import Comment from '../../models/Comment'
import Post from '../../models/Post'

export default defineStatsWidget('content-overview')
  .heading('Publishing metrics')
  .description('Tenant-scoped publishing totals')
  .columnSpan('full')
  .poll(30_000)
  .visible(context => context.actor.tenantId === context.tenant || context.actor.role === 'super-admin')
  .authorize(context => context.actor.tenantId === context.tenant || context.actor.role === 'super-admin')
  .data(async (context) => {
    const [posts, comments] = await Promise.all([
      Post.query().where('tenantId', context.tenant).get(),
      Comment.query().where('tenantId', context.tenant).get(),
    ])
    return {
      stats: [
        {
          action: null,
          chart: [],
          color: 'primary',
          description: 'All tenant posts',
          icon: 'document-text',
          id: 'posts',
          label: 'Posts',
          trend: null,
          url: '/admin/posts',
          value: String(posts.length),
        },
        {
          action: null,
          chart: [],
          color: 'warning',
          description: 'Awaiting moderation',
          icon: 'chat-bubble-left-right',
          id: 'pending-comments',
          label: 'Pending comments',
          trend: null,
          url: '/admin/comments',
          value: String(comments.filter(comment => comment.status === 'pending').length),
        },
      ],
    }
  })
