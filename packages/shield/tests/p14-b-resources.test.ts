import { describe, expect, expectTypeOf, it } from 'vitest'
import { definePanel, ResourceExecutor } from '@holo-js/panels-core'
import {
  createInMemoryShieldRepository,
  shieldAdministrationRepository,
  shieldPermissionResource,
  shieldRoleResource,
} from '../src'

function panel() {
  return definePanel('admin', { prototype: { id: 0 } })
    .tenancy({
      authorize: () => true,
      findMembershipById: async id => typeof id === 'string' ? { id, slug: 'acme' } : null,
      findMembershipByRouteKey: async routeKey => ({ id: 'tenant-a', slug: routeKey }),
      identify: tenant => tenant.id,
      memberships: async () => ({ nextCursor: null, tenants: [{ id: 'tenant-a', slug: 'acme' }] }),
      model: { prototype: { id: '', slug: '' } },
      persistence: { clear: async () => {}, load: async () => null, save: async () => {} },
      present: tenant => ({ label: tenant.slug }),
      routeKey: tenant => tenant.slug,
    })
    .compile()
}

describe('Shield resources', () => {
  it('infers actor and tenant context from the supplied compiled panel', () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    const role = shieldRoleResource({
      panel: panel(),
      repository,
      tenantId: context => {
        expectTypeOf(context.actor).toEqualTypeOf<{ id: number } | null>()
        expectTypeOf(context.tenant.id).toEqualTypeOf<number | string>()
        return context.tenant.id
      },
    }).navigationLabel('Roles').compile()

    expect(role.client.navigation.label).toBe('Roles')
    expect(role.writableAttributes).toEqual(['name', 'super_admin'])
    expect(role.shared).toBe(false)
    expect(role.tenantScope).toBeTypeOf('function')
  })

  it('returns a configurable normal read-only Permission resource', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    const permission = shieldPermissionResource({ panel: panel(), repository, tenantId: context => context.tenant.id })
      .navigationLabel('Permissions')
      .compile()

    expect(permission.client.navigation.label).toBe('Permissions')
    expect(permission.writableAttributes).toEqual([])
    expect(permission.shared).toBe(true)
    expect(permission.capabilities.delete).toBe(false)
    await expect(new ResourceExecutor(permission).create({}, {
      actor: { id: 7 },
      signal: new AbortController().signal,
      tenant: { id: 'tenant-a', routeKey: 'acme' },
    })).rejects.toThrow('read-only')
  })

  it('removes role permission and actor assignments atomically with a deleted role', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    await repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'admin.posts.view', key: 'admin.posts.view' })
      await writer.saveRole({ id: 'editor', name: 'editor', superAdmin: false, tenantId: 'tenant-a' })
      await writer.syncRolePermissions('editor', ['admin.posts.view'])
      await writer.syncActorRoles({ actor: { id: 7, type: 'Admin' }, tenantId: 'tenant-a' }, ['editor'])
    })

    await repository.transaction(writer => writer.deleteRoles(['editor']))

    await expect(repository.loadActorGrants({ actor: { id: 7, type: 'Admin' }, tenantId: 'tenant-a' })).resolves.toEqual({
      directPermissionKeys: [], rolePermissionKeys: [], roles: [],
    })
  })
})
