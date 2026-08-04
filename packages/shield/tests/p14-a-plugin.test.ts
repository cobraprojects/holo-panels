import { definePanel, type PanelAuthorizationRequest } from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { createInMemoryShieldRepository, shield, type ShieldActorGrantQuery } from '../src'

class Actor {
  declare readonly id: string
}

const grants: ShieldActorGrantQuery = {
  actor: { id: 'admin-1', type: 'Admin' },
  tenantId: 7,
}

async function grant(repository: ReturnType<typeof createInMemoryShieldRepository>, permission: string): Promise<void> {
  await repository.transaction(async (writer) => {
    await writer.savePermission({ id: permission, key: permission })
    await writer.saveRole({ id: 'editor', name: 'editor', superAdmin: false, tenantId: 7 })
    await writer.syncRolePermissions('editor', [permission])
    await writer.syncActorRoles(grants, ['editor'])
  })
}

function request(overrides: Partial<PanelAuthorizationRequest<Actor, number>> = {}): PanelAuthorizationRequest<Actor, number> {
  return {
    actor: { id: 'admin-1' },
    guard: 'admin',
    panelId: 'admin',
    permission: 'posts.view',
    signal: new AbortController().signal,
    tenant: 7,
    ...overrides,
  }
}

describe('Shield panel plugin', () => {
  it('installs a server-only authorization layer with the panel namespace by default', async () => {
    const repository = createInMemoryShieldRepository()
    await grant(repository, 'admin.posts.view')
    const plugin = shield<Actor, number>({
      actor: input => ({ id: input.actor.id, type: 'Admin' }),
      repository,
      tenant: input => input.tenant,
    })
    const panel = definePanel('admin', Actor).guard('admin').plugin(plugin).compile()

    expect(panel.server.plugins).toHaveLength(1)
    expect(panel.server.plugins[0]).toMatchObject({ id: 'shield', permissionNamespace: 'admin' })
    await expect(panel.server.plugins[0]!.authorizationLayer!.authorize(request())).resolves.toBeUndefined()
    expect(JSON.stringify(panel.manifest)).not.toContain('shield')
  })

  it('rewrites panel-relative keys into an explicitly shared namespace', async () => {
    const repository = createInMemoryShieldRepository()
    await grant(repository, 'backoffice.posts.view')
    const plugin = shield<Actor, number>({
      actor: input => ({ id: input.actor.id, type: 'Admin' }),
      namespace: 'backoffice',
      repository,
      tenant: input => input.tenant,
    })
    const layer = definePanel('admin', Actor).guard('admin').plugin(plugin).compile().server.plugins[0]!.authorizationLayer!

    await expect(layer.authorize(request({ permission: 'admin.posts.view' }))).resolves.toBeUndefined()
    await expect(layer.authorize(request({ permission: 'backoffice.posts.view' }))).resolves.toBeUndefined()
  })

  it('isolates the same actor between default panel namespaces', async () => {
    const repository = createInMemoryShieldRepository()
    await grant(repository, 'admin.posts.view')
    const plugin = shield<Actor, number>({
      actor: input => ({ id: input.actor.id, type: 'Admin' }),
      repository,
      tenant: input => input.tenant,
    })
    const adminLayer = definePanel('admin', Actor).guard('admin').plugin(plugin).compile().server.plugins[0]!.authorizationLayer!
    const vendorLayer = definePanel('vendor', Actor).guard('vendor').plugin(plugin).compile().server.plugins[0]!.authorizationLayer!

    await expect(adminLayer.authorize(request())).resolves.toBeUndefined()
    await expect(vendorLayer.authorize(request({ guard: 'vendor', panelId: 'vendor' })))
      .rejects.toThrow('vendor.posts.view')
  })

  it('requires explicit actor and tenant resolution and rejects mismatched panel scopes', async () => {
    const repository = createInMemoryShieldRepository()
    const actor = vi.fn(() => grants.actor)
    const tenant = vi.fn(() => grants.tenantId)
    const plugin = shield<Actor, number>({ actor, repository, tenant })
    const layer = definePanel('admin', Actor).guard('admin').plugin(plugin).compile().server.plugins[0]!.authorizationLayer!

    await expect(layer.authorize(request({ panelId: 'vendor' }))).rejects.toThrow('installed panel and guard')
    expect(actor).not.toHaveBeenCalled()
    expect(tenant).not.toHaveBeenCalled()

    const invalidPlugin = shield<Actor, number>({
      actor: () => ({ id: '', type: 'Admin' }),
      repository,
      tenant: () => 7,
    })
    const invalidLayer = definePanel('admin', Actor).guard('admin').plugin(invalidPlugin).compile().server.plugins[0]!.authorizationLayer!
    await expect(invalidLayer.authorize(request())).rejects.toThrow('actor IDs')
  })

  it('honors abort signals before identity resolution', async () => {
    const repository = createInMemoryShieldRepository()
    const actor = vi.fn(() => grants.actor)
    const plugin = shield<Actor, number>({ actor, repository, tenant: () => 7 })
    const layer = definePanel('admin', Actor).guard('admin').plugin(plugin).compile().server.plugins[0]!.authorizationLayer!
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))

    await expect(layer.authorize(request({ signal: controller.signal }))).rejects.toThrow('cancelled')
    expect(actor).not.toHaveBeenCalled()
  })
})
