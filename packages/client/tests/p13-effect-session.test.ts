import {
  panelNotification,
  type Effect,
  type ResponseEnvelope,
} from '@holo-js/panels-core'
import { describe, expect, it, vi } from 'vitest'
import { ClientEffectSession, ClientToastStore } from '../src'

function response(id: string, effects: Effect[]): Readonly<ResponseEnvelope> {
  return Object.freeze({
    data: null,
    effects,
    id,
    ok: true,
    protocolVersion: '1.0',
  })
}

describe('client effect session', () => {
  it('preserves rich toast presentations, maps legacy toasts, and redirects last', async () => {
    const order: string[] = []
    const toastStore = new ClientToastStore()
    toastStore.subscribe((state) => order.push(`toast:${state.items.at(-1)?.id}`))
    const rich = panelNotification('order.ready')
      .title('Order ready')
      .body('Ready for pickup')
      .status('success')
      .icon('package')
      .color('#15803d')
      .persistent()
      .closeable(false)
      .action('open', 'Open order', 'navigate', '/orders/42')
      .presentation()
    const session = new ClientEffectSession({
      panelId: 'commerce',
      toastStore,
      refresh: async effect => { order.push(`refresh:${effect.target}`) },
      redirect: async effect => { order.push(`redirect:${effect.url}`) },
    })

    await session.apply(response('request-1', [
      { kind: 'redirect', url: '/orders/42' },
      { kind: 'toast', presentation: rich },
      { kind: 'refresh', target: 'page' },
      { kind: 'toast', level: 'warning', message: 'Legacy body', title: 'Legacy title', duration: 0 },
    ]))

    expect(toastStore.state.items[0]).toMatchObject({
      ...rich,
      trusted: true,
    })
    expect(toastStore.state.items[1]).toMatchObject({
      body: 'Legacy body',
      duration: null,
      id: 'response.commerce.request-1.4',
      persistent: true,
      status: 'warning',
      title: 'Legacy title',
      trusted: true,
    })
    expect(order).toEqual([
      'toast:order.ready',
      'refresh:page',
      'toast:response.commerce.request-1.4',
      'redirect:/orders/42',
    ])
  })

  it('deduplicates completed effects and resumes from a failed effect without replay', async () => {
    const toastStore = new ClientToastStore()
    const refresh = vi.fn()
      .mockRejectedValueOnce(new Error('refresh failed'))
      .mockResolvedValue(undefined)
    const redirect = vi.fn(async () => undefined)
    const session = new ClientEffectSession({ panelId: 'admin', toastStore, refresh, redirect })
    const envelope = response('request-2', [
      { kind: 'toast', level: 'success', message: 'Saved' },
      { kind: 'refresh' },
      { kind: 'redirect', url: '/done' },
    ])

    await expect(session.apply(envelope)).rejects.toThrow('refresh failed')
    expect(toastStore.state.items).toHaveLength(1)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(redirect).not.toHaveBeenCalled()

    await session.apply(envelope)
    await session.apply(envelope)
    expect(toastStore.state.items).toHaveLength(1)
    expect(refresh).toHaveBeenCalledTimes(2)
    expect(redirect).toHaveBeenCalledTimes(1)
  })

  it('isolates response IDs between panels, fails on unhandled effects, and disposes safely', async () => {
    const firstToasts = new ClientToastStore()
    const secondToasts = new ClientToastStore()
    const dispose = vi.spyOn(firstToasts, 'dispose')
    const first = new ClientEffectSession({ panelId: 'admin', toastStore: firstToasts })
    const second = new ClientEffectSession({ panelId: 'vendor', toastStore: secondToasts })
    const envelope = response('shared-response', [{ kind: 'toast', level: 'info', message: 'Scoped' }])

    await first.apply(envelope)
    await second.apply(envelope)
    expect(firstToasts.state.items[0]?.id).toBe('response.admin.shared-response.1')
    expect(secondToasts.state.items[0]?.id).toBe('response.vendor.shared-response.1')

    await expect(first.apply(response('unhandled', [{ kind: 'focus', componentId: 'search' }])))
      .rejects.toThrow('No client handler is configured for the "focus" effect')

    first.dispose()
    first.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    await expect(first.apply(response('after-dispose', []))).rejects.toThrow('disposed')
  })
})
