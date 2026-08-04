import { describe, expect, it } from 'vitest'
import {
  diffShieldPermissions,
  makeShieldRole,
  seedShieldRoles,
  shieldAdministrationRepository,
  syncShieldPermissions,
} from '../src/commands'
import { createInMemoryShieldRepository } from '../src'

const development = Object.freeze({ environment: 'development' })

describe('Shield command operations', () => {
  it('reports permission differences without mutation', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    await repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'existing-id', key: 'admin.posts.view' })
      await writer.savePermission({ id: 'stale-id', key: 'admin.legacy.view' })
    })

    await expect(diffShieldPermissions(repository, ['admin.posts.view', 'admin.posts.update'])).resolves.toEqual({
      missing: ['admin.posts.update'],
      stale: ['admin.legacy.view'],
      unchanged: ['admin.posts.view'],
    })
    await expect(repository.loadAdministration()).resolves.toMatchObject({
      permissions: expect.arrayContaining([
        { id: 'existing-id', key: 'admin.posts.view' },
        { id: 'stale-id', key: 'admin.legacy.view' },
      ]),
    })
  })

  it('adds missing permissions and preserves stale permissions by default', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    await repository.transaction(writer => writer.savePermission({ id: 'legacy-record', key: 'admin.legacy.view' }))

    const result = await syncShieldPermissions({
      ...development,
      permissionKeys: ['admin.posts.view'],
      repository,
    })

    expect(result).toEqual({ missing: ['admin.posts.view'], stale: ['admin.legacy.view'], unchanged: [] })
    await expect(repository.loadAdministration()).resolves.toMatchObject({
      permissions: [
        { id: 'legacy-record', key: 'admin.legacy.view' },
        { id: 'admin.posts.view', key: 'admin.posts.view' },
      ],
    })
  })

  it('requires both the destructive flag and confirmation before removing stale permissions', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
    await repository.transaction(writer => writer.savePermission({ id: 'legacy-record', key: 'admin.legacy.view' }))

    await expect(syncShieldPermissions({
      ...development,
      permissionKeys: [],
      removeStale: true,
      repository,
    })).rejects.toThrow('explicit confirmation')
    await expect(repository.loadAdministration()).resolves.toMatchObject({
      permissions: [{ id: 'legacy-record', key: 'admin.legacy.view' }],
    })

    await syncShieldPermissions({
      ...development,
      confirmed: true,
      permissionKeys: [],
      removeStale: true,
      repository,
    })
    await expect(repository.loadAdministration()).resolves.toMatchObject({ permissions: [] })
  })

  it('prohibits production mutations unless explicitly configured', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())

    await expect(makeShieldRole(repository, 'editor', { environment: 'production' }))
      .rejects.toThrow('disabled in production')
    await expect(repository.loadAdministration()).resolves.toMatchObject({ roles: [] })

    await expect(makeShieldRole(repository, 'editor', {
      allowProduction: true,
      environment: 'production',
    })).resolves.toEqual({ id: 'editor', name: 'editor', superAdmin: false, tenantId: null })
  })

  it('seeds role permissions atomically with explicit tenant and super-admin state', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())

    await seedShieldRoles(repository, [{
      id: 'tenant-admin',
      name: 'tenant-admin',
      permissionKeys: ['admin.posts.update', 'admin.posts.view'],
      superAdmin: true,
      tenantId: 'tenant-a',
    }], development)

    await expect(repository.loadAdministration()).resolves.toMatchObject({
      roles: [{
        id: 'tenant-admin',
        name: 'tenant-admin',
        superAdmin: true,
        tenantId: 'tenant-a',
      }],
    })
    await repository.transaction(writer => writer.syncActorRoles({
      actor: { id: 'admin-1', type: 'Admin' },
      tenantId: 'tenant-a',
    }, ['tenant-admin']))
    await expect(repository.loadActorGrants({
      actor: { id: 'admin-1', type: 'Admin' },
      tenantId: 'tenant-a',
    })).resolves.toEqual(expect.objectContaining({
      rolePermissionKeys: ['admin.posts.update', 'admin.posts.view'],
    }))
  })

  it('rolls back the whole seed when a later role is invalid', async () => {
    const repository = shieldAdministrationRepository(createInMemoryShieldRepository())

    await expect(seedShieldRoles(repository, [
      { id: 'editor', name: 'editor', permissionKeys: ['admin.posts.view'] },
      { id: 'invalid role', name: 'invalid role', permissionKeys: [] },
    ], development)).rejects.toThrow('stable identifier')
    await expect(repository.loadAdministration()).resolves.toMatchObject({ permissions: [], roles: [] })
  })
})
