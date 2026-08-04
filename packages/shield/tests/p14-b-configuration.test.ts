import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  defineShieldCommandConfiguration,
  permissionKeysFromPreparedRegistry,
  SHIELD_RESOURCE_OPERATIONS,
  type ShieldCommandConfiguration,
} from '../src'

describe('Shield command configuration and prepared permissions', () => {
  it('preserves literal seed inference without caller-declared generic types', () => {
    const configuration = defineShieldCommandConfiguration({
      connection: 'tenant-admin',
      seeds: [{ id: 'editor', name: 'editor', permissionKeys: ['admin.posts.view'] }],
    })

    expectTypeOf(configuration).toMatchTypeOf<Readonly<ShieldCommandConfiguration>>()
    expectTypeOf(configuration.connection).toEqualTypeOf<'tenant-admin'>()
    expectTypeOf(configuration.seeds[0]!.id).toEqualTypeOf<'editor'>()
    expect(configuration).toEqual({
      allowProductionMutations: false,
      connection: 'tenant-admin',
      seeds: [{ id: 'editor', name: 'editor', permissionKeys: ['admin.posts.view'] }],
    })
    expect(Object.isFrozen(configuration)).toBe(true)
    expect(Object.isFrozen(configuration.seeds)).toBe(true)
  })

  it('extracts deterministic permission keys from every approved prepared definition kind', () => {
    const keys = permissionKeysFromPreparedRegistry({
      version: 1,
      definitions: [
        { id: 'publish', kind: 'action', panelId: 'admin', permissionKeys: ['admin.posts.publish'] },
        { id: 'dashboard', kind: 'page', panelId: 'admin', permissionKeys: ['admin.dashboard.view'] },
        { id: 'posts', kind: 'resource', panelId: 'admin', permissionKeys: ['admin.posts.view', 'admin.posts.update'] },
        { id: 'stats', kind: 'widget', panelId: 'admin', permissionKeys: ['admin.stats.view', 'admin.posts.view'] },
      ],
    })
    expect(keys).toEqual([...new Set([
      'admin.actions.publish.view',
      'admin.dashboard.view',
      'admin.pages.dashboard.view',
      'admin.posts.publish',
      'admin.posts.update',
      'admin.posts.view',
      'admin.stats.view',
      'admin.widgets.stats.view',
      ...SHIELD_RESOURCE_OPERATIONS.map(operation => `admin.posts.${operation}`),
    ])].sort((left, right) => left.localeCompare(right)))
  })

  it('rejects malformed prepared metadata and unknown configuration fields', () => {
    expect(() => permissionKeysFromPreparedRegistry({
      version: 1,
      definitions: [{ id: '../posts', kind: 'resource', panelId: 'admin', permissionKeys: [] }],
    })).toThrow('invalid definition')
    expect(() => defineShieldCommandConfiguration({ unexpected: true } as ShieldCommandConfiguration)).toThrow('unsupported fields')
  })
})
