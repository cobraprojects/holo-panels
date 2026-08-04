import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { HoloAuth } from '../src/panels/contracts'
import { definePanel, type PanelBuilder } from '../src/panels/panel'
import { PanelRuntime } from '../src/panels/runtime'

class Actor {
  declare readonly id: number
  declare readonly secret: string
}

const signal = new AbortController().signal

function auth(actor: Actor): HoloAuth<Actor> {
  return {
    guard: () => ({
      provider: async () => 'users',
      user: async () => actor,
    }),
  }
}

describe('P13 panel database notification shell configuration', () => {
  it('compiles deterministic frozen defaults and preserves the concrete builder type', () => {
    const disabled = definePanel('disabled', Actor).compile()
    const builder = definePanel('admin', Actor).databaseNotifications()
    const manifest = builder.compile().manifest

    expectTypeOf(builder).toEqualTypeOf<PanelBuilder<Actor>>()
    expect(disabled.manifest.databaseNotifications).toBeNull()
    expect(manifest.databaseNotifications).toEqual({ placement: 'topbar', polling: 30_000, realtime: false })
    expect(Object.isFrozen(manifest)).toBe(true)
    expect(Object.isFrozen(manifest.databaseNotifications)).toBe(true)
    expect(JSON.parse(JSON.stringify(manifest)).databaseNotifications).toEqual({ placement: 'topbar', polling: 30_000, realtime: false })

    const configured = definePanel('vendor').databaseNotifications({ placement: 'sidebar', polling: false, realtime: true }).compile()
    expect(configured.manifest.databaseNotifications).toEqual({ placement: 'sidebar', polling: false, realtime: true })
  })

  it('rejects invalid polling, placement, and realtime configuration', () => {
    for (const polling of [0, 999, 1_000.5, 3_600_001, Number.NaN]) {
      expect(() => definePanel('admin').databaseNotifications({ polling })).toThrow('polling')
    }
    expect(() => definePanel('admin').databaseNotifications({ placement: 'footer' as never })).toThrow('placement')
    expect(() => definePanel('admin').databaseNotifications({ realtime: 'yes' as never })).toThrow('realtime')
  })

  it('resolves only an opaque realtime channel from the authenticated server scope', async () => {
    const actor: Actor = { id: 7, secret: 'actor-secret' }
    const resolve = vi.fn(async () => ({
      realtimeChannel: 'panels.notifications.opaque-token',
      recipient: { id: actor.id, type: 'staff' },
      tenantId: null,
    }))
    const panel = definePanel('admin', Actor)
      .guard('staff')
      .presentActor(value => ({ id: value.id }))
      .databaseNotifications({ realtime: true })
      .databaseNotificationInbox({ authorize: () => true, resolve })
      .compile()
    const payload = (await new PanelRuntime(auth(actor), [panel]).bootstrap(['admin'], signal))[0]

    expect(resolve).toHaveBeenCalledOnce()
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ actor, guard: 'staff', panelId: 'admin', provider: 'users', signal }))
    expect(payload?.notifications).toEqual({ realtimeChannel: 'panels.notifications.opaque-token' })
    expect(Object.isFrozen(payload?.notifications)).toBe(true)
    expect(JSON.stringify(payload)).not.toContain('actor-secret')
    expect(payload).not.toHaveProperty('guard')
    expect(payload).not.toHaveProperty('tenantId')
    expect(payload).not.toHaveProperty('recipient')
  })

  it('does not invoke realtime resolution for disabled realtime or disabled notifications', async () => {
    const actor: Actor = { id: 7, secret: 'actor-secret' }
    const resolver = vi.fn(async () => ({ realtimeChannel: 'panels.notifications.opaque-token', recipient: { id: 7, type: 'staff' }, tenantId: null }))
    const disabledRealtime = definePanel('admin', Actor)
      .databaseNotifications()
      .databaseNotificationInbox({ authorize: () => true, resolve: resolver })
      .compile()
    const disabled = definePanel('vendor', Actor)
      .databaseNotificationInbox({ authorize: () => true, resolve: resolver })
      .compile()
    const payloads = await new PanelRuntime(auth(actor), [disabledRealtime, disabled]).bootstrap(['admin', 'vendor'], signal)

    expect(payloads[0]?.notifications).toEqual({ realtimeChannel: null })
    expect(payloads[1]?.notifications).toBeNull()
    expect(resolver).not.toHaveBeenCalled()
  })

  it('does not disclose a realtime channel when inbox list access is denied', async () => {
    const actor: Actor = { id: 7, secret: 'actor-secret' }
    const resolve = vi.fn(async () => ({ realtimeChannel: 'panels.notifications.opaque-token', recipient: { id: 7, type: 'staff' }, tenantId: null }))
    const authorize = vi.fn(async () => false)
    const panel = definePanel('admin', Actor)
      .databaseNotifications({ realtime: true })
      .databaseNotificationInbox({ authorize, resolve })
      .compile()

    const payload = (await new PanelRuntime(auth(actor), [panel]).bootstrap(['admin'], signal))[0]

    expect(authorize).toHaveBeenCalledWith('list', expect.objectContaining({ actor, panelId: 'admin' }))
    expect(resolve).not.toHaveBeenCalled()
    expect(payload?.notifications).toEqual({ realtimeChannel: null })
  })

  it('fails closed when a server resolver returns an unsafe channel', async () => {
    const actor: Actor = { id: 7, secret: 'actor-secret' }
    const panel = definePanel('admin', Actor)
      .databaseNotifications({ realtime: true })
      .databaseNotificationInbox({
        authorize: () => true,
        resolve: async () => ({ realtimeChannel: ' private-channel', recipient: { id: 7, type: 'staff' }, tenantId: null }),
      })
      .compile()

    await expect(new PanelRuntime(auth(actor), [panel]).bootstrap(['admin'], signal)).rejects.toThrow('bounded stable channel')

    const reserved = definePanel('admin', Actor)
      .databaseNotifications({ realtime: true })
      .databaseNotificationInbox({
        authorize: () => true,
        resolve: async () => ({ realtimeChannel: 'private-panel-notifications', recipient: { id: 7, type: 'staff' }, tenantId: null }),
      })
      .compile()
    await expect(new PanelRuntime(auth(actor), [reserved]).bootstrap(['admin'], signal)).rejects.toThrow('bounded stable channel')
  })
})
