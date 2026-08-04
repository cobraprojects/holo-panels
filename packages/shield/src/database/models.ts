import { defineModel } from '@holo-js/db'

export const shieldRoleModel = defineModel('panel_shield_roles', table => table
  .string('id').primaryKey()
  .string('name')
  .boolean('super_admin')
  .string('tenant_id_kind')
  .string('tenant_id_value')
  .unique(['name', 'tenant_id_kind', 'tenant_id_value'], 'panel_shield_roles_name_tenant_unique'), {
  name: 'PanelShieldRole',
  fillable: ['id', 'name', 'super_admin', 'tenant_id_kind', 'tenant_id_value'],
  timestamps: false,
})

export const shieldPermissionModel = defineModel('panel_shield_permissions', table => table
  .string('id').primaryKey()
  .string('permission_key').unique(), {
  name: 'PanelShieldPermission',
  guarded: ['*'],
  timestamps: false,
})

export const shieldRolePermissionModel = defineModel('panel_shield_role_permissions', table => table
  .id()
  .string('role_id')
  .string('permission_id')
  .unique(['role_id', 'permission_id'], 'panel_shield_role_permissions_unique'), {
  name: 'PanelShieldRolePermission',
  timestamps: false,
})

export const shieldActorRoleModel = defineModel('panel_shield_actor_roles', table => table
  .id()
  .string('actor_type')
  .string('actor_id_kind')
  .string('actor_id_value')
  .string('role_id')
  .string('tenant_id_kind')
  .string('tenant_id_value')
  .unique(
    ['actor_type', 'actor_id_kind', 'actor_id_value', 'role_id', 'tenant_id_kind', 'tenant_id_value'],
    'panel_shield_actor_roles_unique',
  ), {
  name: 'PanelShieldActorRole',
  timestamps: false,
})

export const shieldActorPermissionModel = defineModel('panel_shield_actor_permissions', table => table
  .id()
  .string('actor_type')
  .string('actor_id_kind')
  .string('actor_id_value')
  .string('permission_id')
  .string('tenant_id_kind')
  .string('tenant_id_value')
  .unique(
    ['actor_type', 'actor_id_kind', 'actor_id_value', 'permission_id', 'tenant_id_kind', 'tenant_id_value'],
    'panel_shield_actor_permissions_unique',
  ), {
  name: 'PanelShieldActorPermission',
  timestamps: false,
})
