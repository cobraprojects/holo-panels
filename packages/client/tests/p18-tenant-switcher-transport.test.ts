import { describe, expect, it } from 'vitest'
import { createPanelTenantSwitcherTransport } from '../src/panel-shell'
import { createTransportRecorder, PanelsTransport, type ClientCsrfProvider } from '../src/transport'

const csrfProvider: ClientCsrfProvider = Object.freeze({
  getField: () => Object.freeze({ name: '_token', value: 'signed-token' }),
})

describe('panel tenant switcher transport', () => {
  it('sends a CSRF-protected same-origin switch and validates the returned identity', async () => {
    const recorder = createTransportRecorder([{
      body: {
        data: { tenant: { id: 'tenant-globex', routeKey: 'globex' } },
        effects: [],
        id: 'tenant-switch-request',
        ok: true,
        protocolVersion: '1.0',
      },
      status: 200,
    }])
    const transport = new PanelsTransport({
      adapter: recorder,
      createId: () => 'tenant-switch-request',
      csrfProvider,
    })

    await expect(createPanelTenantSwitcherTransport(transport, 'admin').switch('globex', new AbortController().signal)).resolves.toEqual({
      tenant: { id: 'tenant-globex', routeKey: 'globex' },
    })
    expect(recorder.requests[0]).toMatchObject({
      credentials: 'same-origin',
      method: 'POST',
      url: '/holo/panels/admin/tenant/switch',
    })
    const fields = new URLSearchParams(recorder.requests[0]!.body)
    expect(fields.get('_token')).toBe('signed-token')
    expect(JSON.parse(fields.get('request')!)).toMatchObject({
      operation: 'switch',
      panelId: 'admin',
      payload: { routeKey: 'globex' },
    })
  })
})
