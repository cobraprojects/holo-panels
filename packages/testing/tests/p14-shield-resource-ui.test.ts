import { TableStateStore } from '@holo-js/panels-client'
import { columnsFor, definePanel } from '@holo-js/panels-core'
import {
  createInMemoryShieldRepository,
  shieldAdministrationRepository,
  shieldPermissionModel,
  shieldPermissionResource,
  shieldRoleModel,
  shieldRoleResource,
} from '@holo-js/panels-shield'
import { describe, expect, it } from 'vitest'
import type { TableAcceptanceFixture, TableAcceptanceModel } from '../src/table-acceptance/contracts'
import { loadExampleExport } from './load-example'

const actor = { id: 7 }
const tenant = { id: 'tenant-a', members: new Set([actor.id]), slug: 'acme' }
const panel = definePanel('admin', { prototype: actor }).tenancy({
  authorize: (value, scope) => value.members.has(scope.actor.id),
  findMembershipById: id => id === tenant.id ? tenant : null,
  findMembershipByRouteKey: routeKey => routeKey === tenant.slug ? tenant : null,
  identify: value => value.id,
  memberships: () => ({ nextCursor: null, tenants: [tenant] }),
  model: { prototype: { id: '', members: new Set([0]), slug: '' } },
  persistence: { clear: async () => {}, load: async () => tenant.id, save: async () => {} },
  present: value => ({ label: value.slug }),
  routeKey: value => value.slug,
}).compile()

const repository = shieldAdministrationRepository(createInMemoryShieldRepository())
const roleColumns = columnsFor(shieldRoleModel)
const permissionColumns = columnsFor(shieldPermissionModel)
const roles = shieldRoleResource({ panel, repository, tenantId: context => context.tenant.id })
  .navigationLabel('Roles')
  .table([roleColumns.text('name'), roleColumns.boolean('super_admin')])
  .compile()
const permissions = shieldPermissionResource({ panel, repository, tenantId: context => context.tenant.id })
  .navigationLabel('Permissions')
  .table([permissionColumns.text('permission_key')])
  .compile()

function model(resource: typeof roles | typeof permissions, records: readonly Record<string, unknown>[]): TableAcceptanceModel {
  const store = new TableStateStore<Record<string, unknown>, number>({
    filterMode: 'live',
    panelId: 'admin',
    perPage: 25,
    records,
    tableId: resource.id,
    total: records.length,
    visibleColumns: resource.id === roles.id ? ['name', 'super_admin'] : ['key'],
  })
  const columns = resource.id === roles.id
    ? [
        { manifest: { alignment: 'start' as const, copyable: false, hidden: false, inlineEditor: null, label: 'Name', path: 'name', sortable: true, toggleable: true, type: 'text', width: null, wrap: true } },
        { manifest: { alignment: 'center' as const, copyable: false, hidden: false, inlineEditor: null, label: 'Super admin', path: 'super_admin', sortable: true, toggleable: true, type: 'boolean', width: null, wrap: false } },
      ]
    : [{ manifest: { alignment: 'start' as const, copyable: true, hidden: false, inlineEditor: null, label: 'Permission', path: 'key', sortable: true, toggleable: true, type: 'text', width: null, wrap: true } }]
  return {
    actionTransport: { execute: async () => {} },
    actions: [],
    caption: String(resource.client.navigation.label),
    columns,
    filters: [],
    getRecordId: record => {
      const id = record.id
      if (typeof id !== 'number') throw new TypeError('Shield UI records require numeric acceptance IDs')
      return id
    },
    getRecordVersion: () => undefined,
    groups: [],
    inlineEditTransport: { execute: async () => {} },
    onQueryChange: () => {},
    store,
    summaries: [],
  }
}

describe('P14 Shield resource UI acceptance', () => {
  it('renders configurable Role and Permission resources through every standard renderer', async () => {
    const fixtures = await Promise.all([
      loadExampleExport<TableAcceptanceFixture>('next', 'p7-table-acceptance-next', 'nextTableAcceptanceFixture'),
      loadExampleExport<TableAcceptanceFixture>('nuxt', 'p7-table-acceptance-nuxt', 'nuxtTableAcceptanceFixture'),
      loadExampleExport<TableAcceptanceFixture>('sveltekit', 'p7-table-acceptance-sveltekit', 'svelteKitTableAcceptanceFixture'),
    ])
    const resources = [
      model(roles, [{ id: 1, name: 'editor', super_admin: false }]),
      model(permissions, [{ id: 1, key: 'admin.posts.view' }]),
    ]

    expect(roles.componentKeys).toContain(`${roles.id}.table`)
    expect(permissions.componentKeys).toContain(`${permissions.id}.table`)
    for (const fixture of fixtures) {
      for (const resource of resources) {
        const rendered = await fixture.render(resource)
        expect(rendered.markup).toContain('<table')
        expect(rendered.markup).toContain(resource.caption)
      }
    }
  }, 60_000)
})
