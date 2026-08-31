import { describe, expect, it, vi } from 'vitest'
import { PanelsTransport } from '../src'
import { DashboardFilterStore } from '../src/widgets/dashboard-filters'

describe('dashboard filter forms', () => {
  it('uses shared form validation and applies server-accepted filters before refreshing widgets', async () => {
    const send = vi.fn(async () => ({ body: { data: { filters: { period: 'year' }, status: 'ready' }, effects: [], id: 'filters', ok: true, protocolVersion: '1.0' }, status: 200 }))
    const store = new DashboardFilterStore({
      filters: { period: 'month' }, panelId: 'admin', pageId: 'overview',
      schema: { fields: [{ kind: 'field', key: 'period', path: 'period', type: 'text', required: true, defaultValue: 'month' }] },
      transport: new PanelsTransport({ adapter: { send }, createId: () => 'filters', csrfProvider: { getField: () => ({ name: '_token', value: 'csrf' }) } }),
    })
    const refresh = vi.fn(async () => undefined)
    store.subscribe(refresh)
    store.form.set('period', '')
    await store.submit()
    expect(send).not.toHaveBeenCalled()
    expect(store.form.state.errors.period).toBeDefined()
    store.form.set('period', 'year')
    await store.submit()
    expect(store.applied).toEqual({ period: 'year' })
    expect(refresh).toHaveBeenCalledOnce()
  })
})
