import { describe, expect, it, vi } from 'vitest'
import {
  composeShieldAuthorization,
  createInMemoryShieldRepository,
  createShieldEvaluator,
  generateShieldPermissionKeys,
  SHIELD_RESOURCE_OPERATIONS,
  type ShieldActorGrantQuery,
  type ShieldAuthorizationError,
  type ShieldLayerAuthorizationError,
  type ShieldRepository,
} from '../src'

const admin: ShieldActorGrantQuery = {
  actor: { id: 'same-id', type: 'Admin' },
  tenantId: 'tenant-a',
}

const vendor: ShieldActorGrantQuery = {
  actor: { id: 'same-id', type: 'Vendor' },
  tenantId: 'tenant-a',
}

async function seedEditor(repository: ShieldRepository): Promise<void> {
  await repository.transaction(async (writer) => {
    await writer.savePermission({ id: 'posts-view', key: 'admin.posts.view' })
    await writer.savePermission({ id: 'posts-update', key: 'admin.posts.update' })
    await writer.saveRole({ id: 'editor', name: 'editor', superAdmin: false, tenantId: null })
    await writer.syncRolePermissions('editor', ['posts-view'])
    await writer.syncActorRoles(admin, ['editor'])
  })
}

describe('Shield permission generation', () => {
  it('generates deterministic panel-relative resource, page, widget, and custom keys', () => {
    const keys = generateShieldPermissionKeys({
      definitions: [
        { id: 'posts', kind: 'resource', panelId: 'admin', permissionKeys: ['posts.publish', 'admin.posts.archive'] },
        { id: 'settings', kind: 'page', panelId: 'admin' },
        { id: 'sales', kind: 'widget', panelId: 'admin', permissionKeys: ['widgets.sales.export'] },
        { id: 'ignored', kind: 'page', panelId: 'vendor' },
      ],
      panelId: 'admin',
    })

    expect(keys).toEqual([...new Set([
      ...SHIELD_RESOURCE_OPERATIONS.map(operation => `admin.posts.${operation}`),
      'admin.posts.publish',
      'admin.posts.archive',
      'admin.pages.settings.view',
      'admin.widgets.sales.view',
      'admin.widgets.sales.export',
    ])].sort())
  })

  it('isolates panel namespaces and permits explicit namespace sharing', () => {
    const definition = (panelId: string) => [{ id: 'posts', kind: 'resource' as const, panelId }]
    const adminKeys = generateShieldPermissionKeys({ definitions: definition('admin'), panelId: 'admin' })
    const vendorKeys = generateShieldPermissionKeys({ definitions: definition('vendor'), panelId: 'vendor' })
    const sharedAdmin = generateShieldPermissionKeys({ definitions: definition('admin'), namespace: 'backoffice', panelId: 'admin' })
    const sharedVendor = generateShieldPermissionKeys({ definitions: definition('vendor'), namespace: 'backoffice', panelId: 'vendor' })

    expect(adminKeys).not.toEqual(vendorKeys)
    expect(sharedAdmin).toEqual(sharedVendor)
  })
})

describe('Shield storage and evaluation', () => {
  it('evaluates role grants while isolating actor type and tenant scope', async () => {
    const repository = createInMemoryShieldRepository()
    await seedEditor(repository)
    const evaluator = createShieldEvaluator({ repository })

    await expect(evaluator.can({ ...admin, permission: 'admin.posts.view' })).resolves.toBe(true)
    await expect(evaluator.can({ ...admin, permission: 'vendor.posts.view' })).resolves.toBe(false)
    await expect(evaluator.can({ ...vendor, permission: 'admin.posts.view' })).resolves.toBe(false)
    await expect(evaluator.can({ ...admin, tenantId: 'tenant-b', permission: 'admin.posts.view' })).resolves.toBe(false)
    await expect(evaluator.authorize({ ...admin, permission: 'admin.posts.update' })).rejects.toEqual(
      expect.objectContaining<Partial<ShieldAuthorizationError>>({ permission: 'admin.posts.update' }),
    )
    evaluator.dispose()
  })

  it('keeps direct permissions opt-in', async () => {
    const repository = createInMemoryShieldRepository()
    await repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'posts-update', key: 'admin.posts.update' })
      await writer.syncActorPermissions(admin, ['posts-update'])
    })
    const rolesOnly = createShieldEvaluator({ repository })
    const direct = createShieldEvaluator({ directPermissions: true, repository })

    await expect(rolesOnly.can({ ...admin, permission: 'admin.posts.update' })).resolves.toBe(false)
    await expect(direct.can({ ...admin, permission: 'admin.posts.update' })).resolves.toBe(true)
    rolesOnly.dispose()
    direct.dispose()
  })

  it('invalidates cached grants only after assignment transactions commit', async () => {
    const repository = createInMemoryShieldRepository()
    await seedEditor(repository)
    const load = vi.spyOn(repository, 'loadActorGrants')
    const evaluator = createShieldEvaluator({ repository })
    const input = { ...admin, permission: 'admin.posts.view' }

    await expect(evaluator.can(input)).resolves.toBe(true)
    await expect(evaluator.can(input)).resolves.toBe(true)
    expect(load).toHaveBeenCalledTimes(1)

    await expect(repository.transaction(async (writer) => {
      await writer.syncActorRoles(admin, [])
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    await expect(evaluator.can(input)).resolves.toBe(true)
    expect(load).toHaveBeenCalledTimes(1)

    await repository.transaction(writer => writer.syncActorRoles(admin, []))
    await expect(evaluator.can(input)).resolves.toBe(false)
    expect(load).toHaveBeenCalledTimes(2)
    evaluator.dispose()
  })

  it('invalidates every affected actor after role permission changes', async () => {
    const repository = createInMemoryShieldRepository()
    await seedEditor(repository)
    const evaluator = createShieldEvaluator({ repository })
    const input = { ...admin, permission: 'admin.posts.view' }

    await expect(evaluator.can(input)).resolves.toBe(true)
    await repository.transaction(writer => writer.syncRolePermissions('editor', []))
    await expect(evaluator.can(input)).resolves.toBe(false)
    evaluator.dispose()
  })

  it('enforces assignment uniqueness, references, and tenant compatibility transactionally', async () => {
    const repository = createInMemoryShieldRepository()
    await repository.transaction(async (writer) => {
      await writer.saveRole({ id: 'tenant-editor', name: 'editor', superAdmin: false, tenantId: 'tenant-b' })
      await writer.savePermission({ id: 'posts-view', key: 'admin.posts.view' })
      await writer.savePermission({ id: 'posts-view', key: 'admin.posts.view' })
      await writer.syncActorPermissions(admin, ['posts-view', 'posts-view'])
    })

    await expect(repository.transaction(writer => writer.syncActorRoles(admin, ['tenant-editor'])))
      .rejects.toThrow('different tenant scope')
    await expect(repository.transaction(writer => writer.syncActorPermissions(admin, ['missing'])))
      .rejects.toThrow('does not exist')
    await expect(repository.loadActorGrants(admin)).resolves.toEqual(expect.objectContaining({
      directPermissionKeys: ['admin.posts.view'],
      roles: [],
    }))
  })

  it('makes super-admin a Shield-only bypass', async () => {
    const repository = createInMemoryShieldRepository()
    await repository.transaction(async (writer) => {
      await writer.saveRole({ id: 'super-admin', name: 'super-admin', superAdmin: true, tenantId: null })
      await writer.syncActorRoles(admin, ['super-admin'])
    })
    const evaluator = createShieldEvaluator({ repository })
    await expect(evaluator.can({ ...admin, permission: 'admin.posts.forceDelete' })).resolves.toBe(true)

    const order: string[] = []
    await expect(composeShieldAuthorization({
      invariant: () => order.push('invariant') > 0,
      panelAccess: () => order.push('panel') > 0,
      policy: () => {
        order.push('policy')
        return false
      },
      shield: async () => {
        order.push('shield')
        await evaluator.authorize({ ...admin, permission: 'admin.posts.forceDelete' })
      },
      tenantAccess: () => order.push('tenant') > 0,
    })).rejects.toEqual(expect.objectContaining<Partial<ShieldLayerAuthorizationError>>({ layer: 'policy' }))
    expect(order).toEqual(['panel', 'tenant', 'shield', 'policy'])
    evaluator.dispose()
  })

  it('short-circuits authorization layers in the required order and preserves thrown policy errors', async () => {
    const shield = vi.fn()
    await expect(composeShieldAuthorization({
      invariant: vi.fn(),
      panelAccess: () => false,
      policy: vi.fn(),
      shield,
      tenantAccess: vi.fn(),
    })).rejects.toEqual(expect.objectContaining<Partial<ShieldLayerAuthorizationError>>({ layer: 'panel' }))
    expect(shield).not.toHaveBeenCalled()

    const policyError = new Error('domain policy denied')
    await expect(composeShieldAuthorization({
      invariant: vi.fn(),
      panelAccess: () => true,
      policy: () => {
        throw policyError
      },
      shield: () => true,
      tenantAccess: () => true,
    })).rejects.toBe(policyError)
  })
})
