import { describe, expect, it } from 'vitest'
import { defineSvelteKitPanelRegistry } from '../src/contracts'

describe('SvelteKit runtime inference', () => {
  it('preserves actor and tenant types in registry callbacks', () => {
    const runtime = {
      bootstrap: async () => [],
      execute: async <TResult>(_panelId: string, _operation: 'action' | 'bootstrap' | 'form-submit' | 'global-search' | 'notification' | 'options' | 'page-data' | 'resolver' | 'table-data' | 'upload', _signal: AbortSignal, handler: (scope: { readonly actor: { readonly id: string }, readonly guard: string, readonly panelId: string, readonly provider: string | null, readonly signal: AbortSignal }) => TResult | Promise<TResult>): Promise<TResult> => handler({ actor: { id: 'actor-1' }, guard: 'web', panelId: 'admin', provider: 'session', signal: new AbortController().signal }),
    }
    const registry = defineSvelteKitPanelRegistry(runtime, {
      operations: {
        action: input => ({ data: { actor: input.scope.actor.id, tenant: input.tenant?.slug ?? null } }),
      },
      resolvePage: input => ({ breadcrumbs: [], data: { actor: input.scope.actor.id, tenant: input.tenant?.slug ?? null }, heading: null, manifest: { actions: { footer: [], header: [] }, body: null, id: 'dashboard', navigation: null, pageType: 'custom', path: '/admin', renderer: null, schemaId: null, slots: {}, widgets: { footer: [], header: [] } }, schema: null, subheading: null, title: 'Dashboard' }),
      resolveTenant: () => ({ slug: 'acme' }),
    })

    expect(registry.resolveTenant).toBeTypeOf('function')
  })
})
