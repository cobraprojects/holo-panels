import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  ClientEffectSession,
  ClientNotificationInboxStore,
  ClientToastStore,
  PanelNotificationRequestError,
  PanelNotification,
  PanelNotificationInbox,
  createPanelNotificationTransport,
  databaseNotificationPayload,
  definePanel,
  executePanelDatabaseNotificationOperation,
  fluxNotificationRealtime,
  holoNotificationStore,
  panelNotification,
  type ClientNotificationRealtime,
  type PanelDatabaseNotificationConfiguration,
  type PanelDatabaseNotificationIdentity,
  type PanelDatabaseNotificationInboxOptions,
  type PanelNotificationPresentation,
} from '../src/index'

class Actor {
  declare readonly id: number
}

describe('P13 umbrella notification exports', () => {
  it('exposes framework-neutral notification, effect, transport, and realtime APIs', () => {
    const presentation = panelNotification('posts.published').title('Published').presentation()
    const configuration: PanelDatabaseNotificationConfiguration = {
      placement: 'topbar',
      polling: 30_000,
      realtime: true,
    }
    const identity: PanelDatabaseNotificationIdentity = {
      realtimeChannel: null,
      recipient: { id: 7, type: 'User' },
      tenantId: 'north',
    }
    const inbox: PanelDatabaseNotificationInboxOptions<Actor> = {
      authorize: () => true,
      resolve: () => identity,
    }
    const panel = definePanel('admin', Actor).databaseNotificationInbox(inbox)

    expectTypeOf(presentation).toMatchTypeOf<PanelNotificationPresentation>()
    expectTypeOf(configuration.placement).toEqualTypeOf<'sidebar' | 'topbar'>()
    expectTypeOf(panel.databaseNotificationInbox).returns.toEqualTypeOf<typeof panel>()
    expect(PanelNotification).toBeTypeOf('function')
    expect(PanelNotificationInbox).toBeTypeOf('function')
    expect(PanelNotificationRequestError).toBeTypeOf('function')
    expect(ClientEffectSession).toBeTypeOf('function')
    expect(ClientNotificationInboxStore).toBeTypeOf('function')
    expect(ClientToastStore).toBeTypeOf('function')
    expect(createPanelNotificationTransport).toBeTypeOf('function')
    expect(databaseNotificationPayload).toBeTypeOf('function')
    expect(executePanelDatabaseNotificationOperation).toBeTypeOf('function')
    expect(fluxNotificationRealtime).toBeTypeOf('function')
    expect(holoNotificationStore).toBeTypeOf('function')
    expectTypeOf<ClientNotificationRealtime['subscribe']>().toBeFunction()
  })
})
