import {
  ResourceBuilder,
  type CompiledPanelDefinition,
  type PanelTenantIdentity,
  type ResourceInput,
  type ResourceRecordFor,
} from '@holo-js/panels-core'
import type { ShieldTenantId } from './contracts'
import { shieldPermissionModel, shieldRoleModel } from './database/models'
import type { ShieldAdministrationRepository } from './repository'

type ActorFor<TPanel> = TPanel extends CompiledPanelDefinition<infer TActor extends object> ? TActor : never

export interface ShieldResourceContext<TActor extends object, TTenant> {
  readonly actor: TActor | null
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface ShieldResourceOptions<TPanel extends CompiledPanelDefinition<never>> {
  readonly panel: TPanel
  readonly repository: ShieldAdministrationRepository
  readonly tenantId: (
    context: ShieldResourceContext<ActorFor<TPanel>, PanelTenantIdentity>,
  ) => ShieldTenantId | Promise<ShieldTenantId>
}

export type ShieldRoleResourceBuilder<TPanel extends CompiledPanelDefinition<never>> = ResourceBuilder<
  typeof shieldRoleModel,
  ResourceRecordFor<typeof shieldRoleModel>,
  ReturnType<typeof shieldRoleModel.query>,
  ResourceInput<ResourceRecordFor<typeof shieldRoleModel>>,
  ActorFor<TPanel>,
  PanelTenantIdentity,
  false
>

export type ShieldPermissionResourceBuilder<TPanel extends CompiledPanelDefinition<never>> = ResourceBuilder<
  typeof shieldPermissionModel,
  ResourceRecordFor<typeof shieldPermissionModel>,
  ReturnType<typeof shieldPermissionModel.query>,
  ResourceInput<ResourceRecordFor<typeof shieldPermissionModel>>,
  ActorFor<TPanel>,
  PanelTenantIdentity,
  false
>

function encodedTenant(tenantId: ShieldTenantId): Readonly<{ tenant_id_kind: 'null' | 'number' | 'string', tenant_id_value: string }> {
  if (tenantId === null) return Object.freeze({ tenant_id_kind: 'null', tenant_id_value: '' })
  if (typeof tenantId === 'number') return Object.freeze({ tenant_id_kind: 'number', tenant_id_value: String(tenantId) })
  return Object.freeze({ tenant_id_kind: 'string', tenant_id_value: tenantId })
}

function roleFromRecord(record: ResourceRecordFor<typeof shieldRoleModel>) {
  const values = record.toJSON()
  const tenantId = values.tenant_id_kind === 'null'
    ? null
    : values.tenant_id_kind === 'number'
      ? Number(values.tenant_id_value)
      : String(values.tenant_id_value)
  return Object.freeze({
    id: String(values.id),
    name: String(values.name),
    superAdmin: values.super_admin === true,
    tenantId,
  })
}

export function shieldRoleResource<const TPanel extends CompiledPanelDefinition<never>>(
  options: ShieldResourceOptions<TPanel>,
): ShieldRoleResourceBuilder<TPanel> {
  if (options.panel.manifest.tenancy === null) throw new Error('Shield Role resources require a tenant-enabled compiled panel')
  return new ResourceBuilder<
    typeof shieldRoleModel,
    ResourceRecordFor<typeof shieldRoleModel>,
    ReturnType<typeof shieldRoleModel.query>,
    ResourceInput<ResourceRecordFor<typeof shieldRoleModel>>,
    ActorFor<TPanel>,
    PanelTenantIdentity,
    false
  >(shieldRoleModel)
    .writableAttributes(['name', 'super_admin'])
    .tenantScope((query, context: ShieldResourceContext<ActorFor<TPanel>, PanelTenantIdentity>) => {
      const tenant = encodedTenant(context.tenant.id)
      return query.where('tenant_id_kind', tenant.tenant_id_kind).where('tenant_id_value', tenant.tenant_id_value)
    })
    .createBindings(async context => {
      const tenantId = await options.tenantId(context)
      if (tenantId !== context.tenant.id) throw new Error('Shield Role resource tenant binding must match the authenticated tenant')
      return Object.freeze({ id: `role-${crypto.randomUUID()}`, ...encodedTenant(tenantId) })
    })
    .lifecycle({
      afterDelete: async record => options.repository.transaction(writer => writer.deleteRoles([String(record.toJSON().id)])),
      afterSave: async record => options.repository.transaction(writer => writer.saveRole(roleFromRecord(record))),
    })
}

export function shieldPermissionResource<const TPanel extends CompiledPanelDefinition<never>>(
  options: ShieldResourceOptions<TPanel>,
): ShieldPermissionResourceBuilder<TPanel> {
  void options
  return new ResourceBuilder<
    typeof shieldPermissionModel,
    ResourceRecordFor<typeof shieldPermissionModel>,
    ReturnType<typeof shieldPermissionModel.query>,
    ResourceInput<ResourceRecordFor<typeof shieldPermissionModel>>,
    ActorFor<TPanel>,
    PanelTenantIdentity,
    false
  >(shieldPermissionModel)
    .shared()
    .readOnly()
}
