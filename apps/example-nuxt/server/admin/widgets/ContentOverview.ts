import { defineStatsWidget } from '@holo-js/panels'
import { AdminActor, canManagePosts } from '../pages/posts/access'

export interface ContentMetrics {
  count(resourceId: 'comments' | 'media' | 'posts', tenantId: string): Promise<number>
}

class ContentOverviewServices {
  declare readonly contentMetrics: ContentMetrics
}

export default defineStatsWidget('content-overview', { actor: AdminActor, services: ContentOverviewServices, tenant: String })
  .heading('Content overview')
  .description('Tenant-scoped publishing activity')
  .columnSpan('full')
  .poll(30_000)
  .authorize(context => context.actor !== null && canManagePosts(context.actor))
  .visible(context => context.tenant.length > 0)
  .data(async context => {
    const [posts, comments, media] = await Promise.all([
      context.services.contentMetrics.count('posts', context.tenant),
      context.services.contentMetrics.count('comments', context.tenant),
      context.services.contentMetrics.count('media', context.tenant),
    ])
    return {
      stats: [
        { action: null, chart: [], color: 'primary', description: 'All posts in this tenant', icon: 'document-text', id: 'posts', label: 'Posts', trend: null, url: '/admin/posts', value: posts },
        { action: null, chart: [], color: 'warning', description: 'Comments awaiting or completing moderation', icon: 'chat-bubble-left', id: 'comments', label: 'Comments', trend: null, url: '/admin/comments', value: comments },
        { action: null, chart: [], color: 'success', description: 'Private media records in this tenant', icon: 'photo', id: 'media', label: 'Media', trend: null, url: '/admin/media', value: media },
      ],
    }
  })
