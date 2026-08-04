import { defineStatsWidget } from '@holo-js/panels'
import { ExampleActor, type ExampleBlogDomain } from '../../domain/blog'

class ExampleWidgetServices {
  declare readonly domain: ExampleBlogDomain
}

export default defineStatsWidget('content-overview', { actor: ExampleActor, services: ExampleWidgetServices, tenant: String })
  .heading('Content overview')
  .description('Tenant-scoped publishing totals')
  .columnSpan(2)
  .poll(30_000)
  .visible(context => context.actor.tenantId === context.tenant)
  .authorize(context => context.actor.tenantId === context.tenant)
  .data((context) => {
    const snapshot = context.services.domain.adminSnapshot(context.actor)
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
          value: String(snapshot.posts.length),
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
          value: String(snapshot.comments.filter(comment => comment.status === 'pending').length),
        },
      ],
    }
  })
