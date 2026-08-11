import { describe, expect, it } from 'vitest'
import { defineNextPanelsRuntime } from '../src/contracts'
import { createPanelOperationRoute } from '../src/operation'
import type { HoloAuth } from '@holo-js/panels-react'

interface Actor {
  readonly id: string
  readonly role: 'admin' | 'viewer'
}

const auth: HoloAuth<Actor> = {
  guard: () => ({
    provider: async () => 'session',
    user: async () => ({ id: 'actor-1', role: 'admin' }),
  }),
}

describe('Next runtime inference', () => {
  it('infers operation scope from runtime resolvers', async () => {
    const observed: string[] = []
    const runtime = defineNextPanelsRuntime({
      auth,
      execute: input => {
        observed.push(input.scope.actor.role)
        observed.push(input.scope.services?.auditChannel ?? '')
        observed.push(input.scope.tenant?.slug ?? '')
        return { data: null }
      },
      registry: {},
      resolveServices: () => ({ auditChannel: 'security' }),
      resolveTenant: () => ({ slug: 'acme' }),
    })
    const route = createPanelOperationRoute({ panelIds: ['admin'], runtime })

    await runtime.execute?.({
      operation: 'action',
      panelId: 'admin',
      payload: {},
      request: new Request('https://example.test'),
      scope: {
        actor: { id: 'actor-1', role: 'admin' },
        locale: 'en',
        panelId: 'admin',
        parameters: {},
        provider: 'session',
        request: new Request('https://example.test'),
        services: { auditChannel: 'security' },
        signal: new AbortController().signal,
        tenant: { slug: 'acme' },
      },
    })

    expect(observed).toEqual(['admin', 'security', 'acme'])
    expect(route.POST).toBeTypeOf('function')
  })
})
