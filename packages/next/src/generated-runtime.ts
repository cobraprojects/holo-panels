import { createNextHoloHelpers } from '@holo-js/adapter-next/runtime'
import type { HoloAuth } from '@holo-js/panels-react'
import { executeGeneratedGlobalSearch, executeGeneratedResourceOperation, executeGeneratedUploadOperation, executeGeneratedWidgetOperation, executePanelDatabaseNotificationOperation, toJsonValue, type CompiledPanelDefinition } from '@holo-js/panels-react/server'
import type { NextPanelServerRegistry, NextPanelsRuntime } from './contracts'

const holo = createNextHoloHelpers({ projectRoot: process.cwd() })

interface TenantScopedQuery<TQuery> {
  where(column: string, operator: '=', value: number | string): TQuery & TenantScopedQuery<TQuery>
}

async function generatedAuth(): Promise<HoloAuth<object>> {
  const binding = await holo.getAuth()
  if (!binding) throw new Error('[Holo Panels] Holo Auth must be configured before serving a panel.')
  return binding
}

export function createGeneratedNextPanelsRuntime(registry: NextPanelServerRegistry): NextPanelsRuntime {
  const runtime: NextPanelsRuntime = {
    auth: generatedAuth,
    async execute(input) {
      if (input.operation === 'notification') {
        const loader = registry[`${input.panelId}:panel:${input.panelId}`]
        if (!loader) throw new Error('[Holo Panels] The requested panel is not registered.')
        const value = await loader()
        const panel = ('compile' in value && typeof value.compile === 'function' ? value.compile() : value) as CompiledPanelDefinition<object>
        const result = await executePanelDatabaseNotificationOperation({
          panel,
          payload: input.payload,
          registry,
          scope: { actor: input.scope.actor, guard: panel.guard, panelId: input.panelId, provider: input.scope.provider, signal: input.scope.signal },
        })
        return { data: toJsonValue(result), effects: 'effects' in result ? result.effects : [] }
      }
      if (input.operation === 'global-search') {
        const loader = registry[`${input.panelId}:panel:${input.panelId}`]
        if (!loader) throw new Error('[Holo Panels] The requested panel is not registered.')
        const value = await loader()
        const panel = ('compile' in value && typeof value.compile === 'function' ? value.compile() : value) as CompiledPanelDefinition<object>
        if (!panel.manifest.globalSearch) throw new Error('[Holo Panels] Global search is not enabled for this panel.')
        const resources = await Promise.all(Object.entries(registry)
          .filter(([key]) => key.startsWith(`${input.panelId}:resource:`))
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([, resourceLoader]) => resourceLoader()))
        const term = input.payload.term
        if (typeof term !== 'string') throw new Error('[Holo Panels] Global search requires a search term.')
        return {
          data: await executeGeneratedGlobalSearch({
            actor: input.scope.actor,
            panelId: input.panelId,
            panelPath: panel.manifest.path,
            resources,
            resourceOptIn: panel.manifest.globalSearchConfiguration?.resourceOptIn,
            signal: input.scope.signal,
            strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
            tenant: input.scope.tenant,
            term,
            ...(input.scope.scopeTenantQuery ? { scopeTenantQuery: input.scope.scopeTenantQuery } : {}),
            ...(input.scope.tenantBindings ? { tenantBindings: input.scope.tenantBindings } : {}),
          }),
        }
      }
      if (input.operation === 'upload') {
        const resourceId = input.payload.resourceId
        if (typeof resourceId !== 'string') throw new Error('[Holo Panels] Generated upload operations require a resource ID.')
        const loader = registry[`${input.panelId}:resource:${resourceId}`]
        const panelLoader = registry[`${input.panelId}:panel:${input.panelId}`]
        if (!loader || !panelLoader) throw new Error('[Holo Panels] The requested upload resource is not registered for this panel.')
        const panelValue = await panelLoader()
        const panel = ('compile' in panelValue && typeof panelValue.compile === 'function' ? panelValue.compile() : panelValue) as CompiledPanelDefinition<object>
        const scope = { actor: input.scope.actor, guard: panel.guard, panelId: input.panelId, provider: input.scope.provider, signal: input.scope.signal }
        const tenancy = input.scope.tenant === undefined && panel.server.tenancy ? await panel.server.tenancy.activeContext(scope) : null
        const form = await input.request.clone().formData()
        const binary = form.get('contents')
        const contents = binary && typeof binary === 'object' && 'arrayBuffer' in binary && typeof binary.arrayBuffer === 'function'
          ? new Uint8Array(await binary.arrayBuffer())
          : undefined
        return {
          data: await executeGeneratedUploadOperation(await loader(), {
            ...(contents ? { contents } : {}),
            context: {
              actor: input.scope.actor,
              signal: input.scope.signal,
              tenant: input.scope.tenant ?? tenancy?.tenantId,
              ...(tenancy?.tenantBindings ? { tenantBindings: tenancy.tenantBindings } : {}),
              ...(tenancy?.scopeTenantQuery ? { scopeTenantQuery: <TQuery>(query: TQuery): TQuery => tenancy.scopeTenantQuery(query as TQuery & TenantScopedQuery<TQuery>) } : {}),
            },
            panelId: input.panelId,
            payload: input.payload,
            strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
          }),
        }
      }
      if (input.operation !== 'action' && input.operation !== 'form-submit' && input.operation !== 'options' && input.operation !== 'table-data') throw new Error(`[Holo Panels] Generated operation "${input.operation}" is not available.`)
      if (input.operation === 'action' && input.payload.widgetId !== undefined) {
        const loader = registry[`${input.panelId}:panel:${input.panelId}`]
        if (!loader) throw new Error('[Holo Panels] The requested panel is not registered.')
        const value = await loader()
        const panel = ('compile' in value && typeof value.compile === 'function' ? value.compile() : value) as CompiledPanelDefinition<object>
        return executeGeneratedWidgetOperation(registry, input.payload, input.scope, panel)
      }
      const resourceId = input.payload.resourceId
      if (typeof resourceId !== 'string') throw new Error('[Holo Panels] Generated resource operations require a resource ID.')
      const loader = registry[`${input.panelId}:resource:${resourceId}`]
      const panelLoader = registry[`${input.panelId}:panel:${input.panelId}`]
      if (!loader || !panelLoader) throw new Error('[Holo Panels] The requested resource is not registered for this panel.')
      const resource = await loader()
      const panelValue = await panelLoader()
      const panel = ('compile' in panelValue && typeof panelValue.compile === 'function' ? panelValue.compile() : panelValue) as CompiledPanelDefinition<object>
      return await executeGeneratedResourceOperation(resource, {
        context: {
          actor: input.scope.actor,
          signal: input.scope.signal,
          tenant: input.scope.tenant,
          ...(input.scope.scopeTenantQuery ? { scopeTenantQuery: input.scope.scopeTenantQuery } : {}),
          ...(input.scope.tenantBindings ? { tenantBindings: input.scope.tenantBindings } : {}),
        },
        operation: input.operation,
        panel,
        panelId: input.panelId,
        payload: input.payload,
        strictAuthorization: panel.manifest.runtime?.strictAuthorization ?? false,
      })
    },
    registry,
    resolveServices: async () => (await holo.getApp()).runtime,
  }
  return Object.freeze(runtime)
}
