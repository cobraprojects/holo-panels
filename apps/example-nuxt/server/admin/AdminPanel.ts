import { definePanel } from '@holo-js/panels'
import User from '../models/User'

class AdminActor {
  declare readonly email: string
  declare readonly id: number | string
  declare readonly role: string
  declare readonly tenantId: string | null
}

class ExampleTenant {
  declare readonly id: string
  declare readonly name: string
  declare readonly slug: string
}

const tenants = Object.freeze([
  Object.freeze({ id: 'tenant-acme', name: 'Acme', slug: 'acme' }),
  Object.freeze({ id: 'tenant-globex', name: 'Globex', slug: 'globex' }),
])

function actorTenants(actor: AdminActor): readonly ExampleTenant[] {
  return actor.role === 'super-admin' ? tenants : tenants.filter(tenant => tenant.id === actor.tenantId)
}

export default definePanel('admin', AdminActor)
  .path('/admin')
  .guard('web')
  .auth({
    login: { path: '/admin/login', redirectTo: '/admin' },
    logout: true,
    multiFactor: { challengePath: '/admin/mfa-challenge', enrollmentPath: '/admin/profile/mfa' },
  })
  .tenancy({
    authorize: (tenant, { actor }) => actorTenants(actor).some(candidate => candidate.id === tenant.id),
    findMembershipById: (id, { actor }) => actorTenants(actor).find(tenant => tenant.id === id) ?? null,
    findMembershipByRouteKey: (routeKey, { actor }) => actorTenants(actor).find(tenant => tenant.slug === routeKey) ?? null,
    identify: tenant => tenant.id,
    memberships: (_request, { actor }) => ({ nextCursor: null, tenants: actorTenants(actor) }),
    model: ExampleTenant,
    persistence: {
      async clear({ actor }) {
        if (actor.tenantId === null) return
        const user = await User.where('id', actor.id).first()
        if (user) await user.update({ tenantId: actor.tenantId })
      },
      async load({ actor }) {
        return actor.tenantId
      },
      async save({ actor }, tenantId) {
        if (typeof tenantId !== 'string') throw new TypeError('Example tenant identifiers must be strings')
        const user = await User.where('id', actor.id).first()
        if (user) await user.update({ tenantId })
      },
    },
    present: tenant => ({ label: tenant.name }),
    routeKey: tenant => tenant.slug,
  })
  .default()
  .access(context => ['admin', 'editor', 'super-admin', 'tenant-admin'].includes(context.actor.role))
  .presentActor(actor => ({ email: actor.email, id: actor.id, role: actor.role }))
  .databaseNotifications({ realtime: true })
  .databaseNotificationInbox({
    authorize: () => true,
    resolve: ({ actor }) => ({
      realtimeChannel: `panels.notifications.web.${actor.id}`,
      recipient: { id: actor.id, type: 'users' },
      tenantId: null,
    }),
  })
  .branding({ name: 'Holo Panels Admin' })
  .discoverResources()
  .discoverPages()
  .discoverWidgets()
