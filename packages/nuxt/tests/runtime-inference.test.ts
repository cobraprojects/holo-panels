import { describe, expect, it } from 'vitest'
import { defineNuxtPanelRuntime } from '../src/contracts'
import { createPanelOperationHandler } from '../src/server'

describe('Nuxt runtime inference', () => {
  it('preserves tenant results in operation contexts', () => {
    const runtime = defineNuxtPanelRuntime({
      execute: context => ({ data: context.tenant?.slug ?? null }),
      panels: { admin: { access: () => true, guard: 'web' } },
      resolveTenant: () => ({ slug: 'acme' }),
    })

    const handler = createPanelOperationHandler({ panelIds: ['admin'], runtime })
    expect(handler).toBeTypeOf('function')
  })
})
