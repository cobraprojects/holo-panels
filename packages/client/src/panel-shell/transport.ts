import type { JsonValue } from '@holo-js/panels-core'
import type { PanelsTransport } from '../transport'
import type { PanelTenantSwitcherTransport } from './contracts'

const PANEL_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u

function tenantIdentity(value: JsonValue): { readonly tenant: { readonly id: number | string, readonly routeKey: string } } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('[Holo Panels] Tenant switch responses require an object.')
  const tenant = value.tenant
  if (typeof tenant !== 'object' || tenant === null || Array.isArray(tenant)) throw new Error('[Holo Panels] Tenant switch responses require a tenant identity.')
  if ((typeof tenant.id !== 'number' && typeof tenant.id !== 'string') || typeof tenant.routeKey !== 'string' || !tenant.routeKey) {
    throw new Error('[Holo Panels] Tenant switch responses contain an invalid tenant identity.')
  }
  return Object.freeze({ tenant: Object.freeze({ id: tenant.id, routeKey: tenant.routeKey }) })
}

export function createPanelTenantSwitcherTransport(transport: PanelsTransport, panelId: string): PanelTenantSwitcherTransport {
  if (!PANEL_ID.test(panelId)) throw new Error('[Holo Panels] Tenant switchers require a stable panel ID.')
  return Object.freeze({
    async switch(routeKey: string, signal: AbortSignal) {
      const response = await transport.execute({ kind: 'mutation', name: 'switch', supportsIdempotency: true }, {
        endpoint: `/holo/panels/${encodeURIComponent(panelId)}/tenant/switch`,
        panelId,
        payload: { routeKey },
        signal,
      })
      if (!response.ok) throw new Error(`[Holo Panels] Tenant switch failed: ${response.error.message}`)
      return tenantIdentity(response.data)
    },
  })
}
