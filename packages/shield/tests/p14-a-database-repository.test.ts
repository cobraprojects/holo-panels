import {
  configureDB,
  createConnectionManager,
  createDatabase,
  createDialect,
  createSchemaService,
  resetDB,
  type DriverAdapter,
} from '@holo-js/db'
import { SQLiteAdapter } from '@holo-js/db-sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPanelShieldTables } from '../src/database/migration'
import { createHoloShieldRepository } from '../src/database/repository'
import { shieldAdministrationRepository } from '../src/repository'

describe('Holo database Shield repository', () => {
  let adapter: DriverAdapter

  beforeEach(async () => {
    adapter = new SQLiteAdapter({ filename: ':memory:' })
    const database = createDatabase({
      adapter,
      connectionName: 'default',
      dialect: createDialect('sqlite'),
    })
    configureDB(createConnectionManager({
      connections: { default: database },
      defaultConnection: 'default',
    }))
    await database.initialize()
    await createPanelShieldTables.up({ db: database, schema: createSchemaService(database) })
  })

  afterEach(async () => {
    await adapter.disconnect()
    resetDB()
  })

  it('persists grants without collapsing actor or tenant primitive identity', async () => {
    const repository = createHoloShieldRepository()
    await repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'view', key: 'posts.view' })
      await writer.savePermission({ id: 'edit', key: 'posts.edit' })
      await writer.saveRole({ id: 'global-editor', name: 'editor', superAdmin: false, tenantId: null })
      await writer.saveRole({ id: 'tenant-editor', name: 'editor', superAdmin: false, tenantId: 1 })
      await writer.syncRolePermissions('global-editor', ['edit', 'view', 'view'])
      await writer.syncActorRoles({ actor: { id: 1, type: 'User' }, tenantId: 1 }, ['global-editor', 'tenant-editor'])
      await writer.syncActorPermissions({ actor: { id: '1', type: 'User' }, tenantId: '1' }, ['edit'])
    })

    await expect(repository.loadActorGrants({ actor: { id: 1, type: 'User' }, tenantId: 1 })).resolves.toEqual({
      directPermissionKeys: [],
      rolePermissionKeys: ['posts.edit', 'posts.view'],
      roles: [
        { id: 'global-editor', name: 'editor', superAdmin: false, tenantId: null },
        { id: 'tenant-editor', name: 'editor', superAdmin: false, tenantId: 1 },
      ],
    })
    await expect(repository.loadActorGrants({ actor: { id: '1', type: 'User' }, tenantId: '1' })).resolves.toEqual({
      directPermissionKeys: ['posts.edit'],
      rolePermissionKeys: [],
      roles: [],
    })
    await expect(repository.loadActorGrants({ actor: { id: 1, type: 'Admin' }, tenantId: 1 })).resolves.toEqual({
      directPermissionKeys: [],
      rolePermissionKeys: [],
      roles: [],
    })
  })

  it('enforces uniqueness, references, tenant scope, rollback, and post-commit invalidation', async () => {
    const repository = createHoloShieldRepository()
    const administration = shieldAdministrationRepository(repository)
    const listener = vi.fn()
    repository.subscribe(listener)
    await repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'view', key: 'posts.view' })
      expect(listener).not.toHaveBeenCalled()
      await writer.saveRole({ id: 'tenant-role', name: 'manager', superAdmin: false, tenantId: 9 })
    })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith(null)

    listener.mockClear()
    await expect(repository.transaction(async (writer) => {
      await writer.savePermission({ id: 'duplicate', key: 'posts.view' })
    })).rejects.toThrow('already assigned')
    expect(listener).not.toHaveBeenCalled()
    await expect(administration.loadAdministration()).resolves.toMatchObject({
      permissions: [{ id: 'view', key: 'posts.view' }],
    })

    await expect(repository.transaction(async (writer) => {
      await writer.syncActorRoles({ actor: { id: 4, type: 'User' }, tenantId: 8 }, ['tenant-role'])
    })).rejects.toThrow('different tenant scope')
    await expect(repository.transaction(async (writer) => {
      await writer.syncActorPermissions({ actor: { id: 4, type: 'User' }, tenantId: 9 }, ['missing'])
    })).rejects.toThrow('does not exist')

    const query = { actor: { id: 4, type: 'User' }, tenantId: 9 } as const
    await repository.transaction(async (writer) => writer.syncActorRoles(query, ['tenant-role']))
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenLastCalledWith(query)

    listener.mockClear()
    await expect(repository.transaction(async (writer) => {
      await writer.syncActorPermissions(query, ['view'])
      throw new Error('rollback')
    })).rejects.toThrow('rollback')
    expect(listener).not.toHaveBeenCalled()
    await expect(repository.loadActorGrants(query)).resolves.toMatchObject({ directPermissionKeys: [] })
  })

  it('drops all Shield tables in dependency order', async () => {
    const database = createDatabase({
      adapter,
      connectionName: 'secondary',
      dialect: createDialect('sqlite'),
    })
    await createPanelShieldTables.down({ db: database, schema: createSchemaService(database) })
    await expect(database.unsafeQuery({ unsafe: true, sql: 'SELECT * FROM panel_shield_roles' })).rejects.toThrow()
  })
})
