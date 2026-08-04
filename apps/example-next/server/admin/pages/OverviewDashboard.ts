import { defineCustomPage, resolveWidget } from '@holo-js/panels'
import { ExampleActor, type ExampleBlogDomain } from '../../domain/blog'
import ContentOverview from '../widgets/ContentOverview'

class ExampleDashboardServices {
  declare readonly domain: ExampleBlogDomain
}

export default defineCustomPage('overview', {
  actor: ExampleActor,
  load: async (context) => {
    const result = await resolveWidget(ContentOverview.compile(), {
      actor: context.actor,
      locale: context.locale,
      panelId: context.panelId,
      services: context.services,
      signal: context.signal,
      tenant: context.tenant,
    })
    if (result.status !== 'ready' || !result.data) return { stats: [], status: result.status }
    return {
      stats: result.data.stats.map(stat => ({
        description: stat.description,
        id: stat.id,
        label: stat.label,
        url: stat.url,
        value: stat.value,
      })),
      status: result.status,
    }
  },
  services: ExampleDashboardServices,
  tenant: String,
})
  .path('/admin')
  .title('Overview')
  .heading('Content overview')
  .subheading('Tenant-scoped publishing and moderation totals')
  .navigation({ icon: 'home', label: 'Overview', sort: 1 })
  .headerWidgets('content-overview')
  .authorize(context => context.actor.tenantId === context.tenant)
