import { describe, expect, it, vi } from 'vitest'
import { PanelsTransport } from '../src'
import { DashboardFilterStore } from '../src/widgets/dashboard-filters'

describe('dashboard filter forms', () => {
  it('uses shared form validation and applies server-accepted filters before refreshing widgets', async () => {
    const send = vi.fn(async () => ({ body: { data: { filters: { period: 'year' }, status: 'ready' }, effects: [], id: 'filters', ok: true, protocolVersion: '1.0' }, status: 200 }))
    const store = new DashboardFilterStore({
      filters: { period: 'month' }, panelId: 'admin', pageId: 'overview', locale: 'ar',
      schema: { fields: [{ kind: 'field', key: 'period', path: 'period', type: 'text', required: true, defaultValue: 'month' }] },
      transport: new PanelsTransport({ adapter: { send }, createId: () => 'filters', csrfProvider: { getField: () => ({ name: '_token', value: 'csrf' }) } }),
    })
    const refresh = vi.fn(async () => undefined)
    store.subscribe(refresh)
    store.form.set('period', '')
    await store.submit()
    expect(send).not.toHaveBeenCalled()
    expect(store.form.state.errors.period).toEqual(['هذا الحقل مطلوب.'])
    store.form.set('period', 'year')
    store.form.applyServerPatch({ errors: {}, operations: [{ kind: 'pending', path: 'period', value: true }] })
    await store.submit()
    expect(send).not.toHaveBeenCalled()
    expect(store.form.state.errors.period).toEqual(['انتظر حتى يكتمل هذا الحقل قبل الحفظ.'])
    store.form.applyServerPatch({ errors: {}, operations: [{ kind: 'pending', path: 'period', value: false }] })
    await store.submit()
    expect(store.applied).toEqual({ period: 'year' })
    expect(refresh).toHaveBeenCalledOnce()
  })
})
