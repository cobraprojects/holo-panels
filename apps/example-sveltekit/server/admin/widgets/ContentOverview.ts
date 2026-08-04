import { defineDashboard, defineStatsWidget, resolveWidget } from '@holo-js/panels'
import type { JsonObject as SvelteJsonObject } from '@holo-js/panels-svelte'
import { canAccessTenant, canBootstrapAdmin, ExampleAdminActor } from '../access'
import {
  exampleComments,
  examplePosts,
  recordsForTenant,
} from '../../fixtures/example-domain'

export const ContentOverviewWidget = defineStatsWidget('content-overview', { actor: ExampleAdminActor, tenant: String })
  .heading('Content overview')
  .description('Tenant-scoped publishing and moderation totals')
  .columnSpan('full')
  .poll(30_000)
  .authorize(context => canBootstrapAdmin(context.actor) && canAccessTenant(context.actor, context.tenant))
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

export const ContentDashboard = defineDashboard('content-dashboard', { actor: ExampleAdminActor, tenant: String })
  .path('/admin')
  .default()
  .navigation('Overview', { icon: 'home', sort: 0 })
  .widgets('content-overview')
  .authorize(context => canBootstrapAdmin(context.actor) && canAccessTenant(context.actor, context.tenant))

export async function resolveContentOverview(actor: ExampleAdminActor, tenant: string, signal: AbortSignal): Promise<SvelteJsonObject> {
  const resolved = await resolveWidget(ContentOverviewWidget.compile(), {
    actor,
    locale: 'en',
    panelId: 'admin',
    services: {},
    signal,
    tenant,
  }, {})
  return {
    data: resolved.data,
    manifest: resolved.manifest,
    status: resolved.status,
  }
}
