import { describe, expect, it, vi } from 'vitest'
import { createWidgetActionStore, PanelsTransport, type ClientActionManifest } from '../src'

const action: ClientActionManifest = { badge: null, color: null, confirmation: null, disabled: false, icon: null, id: 'publish', kind: 'custom', label: 'Publish', modal: null, mount: 'page', size: 'medium', tooltip: null, type: 'custom', visible: true }
const csrfProvider = { getField: () => ({ name: '_token', value: 'csrf-token' }) }

describe('widget action transport', () => {
  it('sends the registered host and submitted input and applies response effects once', async () => {
    const send = vi.fn(async () => ({ body: { data: { published: true }, effects: [], id: 'widget-response', ok: true, protocolVersion: '1.0' }, status: 200 }))
    const applyEffects = vi.fn(async () => undefined)
    const store = createWidgetActionStore({ applyEffects, panelId: 'admin', resourceId: 'posts', transport: new PanelsTransport({ adapter: { send }, createId: () => 'widget-response', csrfProvider }), widgetId: 'overview' })
    store.mount(action, { status: 'published' })
    const first = store.submit()
    expect(store.submit()).toBe(first)
    await first
    expect(send).toHaveBeenCalledOnce()
    expect(send.mock.calls[0]).toBeDefined()
    expect(decodeURIComponent(JSON.stringify(send.mock.calls))).toContain('overview')
    expect(decodeURIComponent(JSON.stringify(send.mock.calls))).toContain('published')
    expect(applyEffects).toHaveBeenCalledOnce()
    expect(store.activeFrame?.result?.result).toEqual({ published: true })
  })

  it('aborts an active widget request when its action closes', async () => {
    let activeSignal: AbortSignal | undefined
    const transport = new PanelsTransport({ csrfProvider, adapter: { send: request => new Promise((_resolve, reject) => {
      activeSignal = request.signal
      request.signal?.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true })
    }) } })
    const store = createWidgetActionStore({ applyEffects: async () => undefined, panelId: 'admin', transport, widgetId: 'overview' })
    store.mount(action)
    const pending = store.submit().catch(() => undefined)
    store.close()
    await pending
    expect(activeSignal?.aborted).toBe(true)
    expect(store.activeFrame).toBeNull()
  })
})
