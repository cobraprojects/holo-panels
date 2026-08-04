import { defineMigration } from '@holo-js/db'

export const createPanelShieldTables = defineMigration({
  name: '2026_07_28_000001_create_panel_shield_tables',
  async up({ schema }) {
    await schema.createTable('panel_shield_roles', (table) => {
      table.string('id').primaryKey()
      table.string('name')
      table.boolean('super_admin').default(false)
      table.string('tenant_id_kind')
      table.string('tenant_id_value')
      table.unique(['name', 'tenant_id_kind', 'tenant_id_value'], 'panel_shield_roles_name_tenant_unique')
    })
    await schema.createTable('panel_shield_permissions', (table) => {
      table.string('id').primaryKey()
      table.string('permission_key').unique()
    })
    await schema.createTable('panel_shield_role_permissions', (table) => {
      table.id()
      table.string('role_id')
      table.string('permission_id')
      table.foreign('role_id').references('id').on('panel_shield_roles').cascadeOnDelete()
      table.foreign('permission_id').references('id').on('panel_shield_permissions').cascadeOnDelete()
      table.unique(['role_id', 'permission_id'], 'panel_shield_role_permissions_unique')
    })
    await schema.createTable('panel_shield_actor_roles', (table) => {
      table.id()
      table.string('actor_type')
      table.string('actor_id_kind')
      table.string('actor_id_value')
      table.string('role_id')
      table.string('tenant_id_kind')
      table.string('tenant_id_value')
      table.foreign('role_id').references('id').on('panel_shield_roles').cascadeOnDelete()
      table.unique(
        ['actor_type', 'actor_id_kind', 'actor_id_value', 'role_id', 'tenant_id_kind', 'tenant_id_value'],
        'panel_shield_actor_roles_unique',
      )
    })
    await schema.createTable('panel_shield_actor_permissions', (table) => {
      table.id()
      table.string('actor_type')
      table.string('actor_id_kind')
      table.string('actor_id_value')
      table.string('permission_id')
      table.string('tenant_id_kind')
      table.string('tenant_id_value')
      table.foreign('permission_id').references('id').on('panel_shield_permissions').cascadeOnDelete()
      table.unique(
        ['actor_type', 'actor_id_kind', 'actor_id_value', 'permission_id', 'tenant_id_kind', 'tenant_id_value'],
        'panel_shield_actor_permissions_unique',
      )
    })
  },
  async down({ schema }) {
    await schema.dropTable('panel_shield_actor_permissions')
    await schema.dropTable('panel_shield_actor_roles')
    await schema.dropTable('panel_shield_role_permissions')
    await schema.dropTable('panel_shield_permissions')
    await schema.dropTable('panel_shield_roles')
  },
})
