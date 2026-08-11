import { defineStatsWidget } from '@holo-js/panels'
import Comment from '../../models/Comment'
import Media from '../../models/Media'
import Post from '../../models/Post'

export default defineStatsWidget('content-overview')
  .heading('Content overview')
  .description('Tenant-scoped publishing activity')
  .columnSpan('full')
  .poll(30_000)
  .authorize(context => context.actor !== null && ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(context.actor.role))
  .visible(context => context.tenant.length > 0)
  .data(async context => {
    const [posts, comments, media] = await Promise.all([
      Post.where('tenantId', context.tenant).count(),
      Comment.where('tenantId', context.tenant).count(),
      Media.where('tenantId', context.tenant).count(),
    ])
    return {
      stats: [
        { action: null, chart: [], color: 'primary', description: 'All posts in this tenant', icon: 'document-text', id: 'posts', label: 'Posts', trend: null, url: '/admin/posts', value: posts },
        { action: null, chart: [], color: 'warning', description: 'Comments awaiting or completing moderation', icon: 'chat-bubble-left', id: 'comments', label: 'Comments', trend: null, url: '/admin/comments', value: comments },
        { action: null, chart: [], color: 'success', description: 'Private media records in this tenant', icon: 'photo', id: 'media', label: 'Media', trend: null, url: '/admin/media', value: media },
      ],
    }
  })
