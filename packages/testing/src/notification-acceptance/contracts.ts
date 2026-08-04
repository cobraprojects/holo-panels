import type { ClientNotificationInboxStore, ClientToastStore } from '@holo-js/panels-client'

export interface NotificationAcceptanceModel {
  readonly inboxPlacement: 'sidebar'
  readonly inboxStore: ClientNotificationInboxStore
  readonly panelId: string
  readonly toastPlacement: 'bottom'
  readonly toastStore: ClientToastStore
}

export interface NotificationAcceptanceRenderReport {
  readonly framework: 'react' | 'svelte' | 'vue'
  readonly markup: string
  readonly ssrStable: boolean
}

export interface NotificationAcceptanceFixture {
  readonly framework: NotificationAcceptanceRenderReport['framework']
  render(model: NotificationAcceptanceModel): Promise<NotificationAcceptanceRenderReport>
}

export interface NotificationAcceptanceJourneyReport {
  readonly actionObserved: string
  readonly deleted: boolean
  readonly framework: NotificationAcceptanceRenderReport['framework']
  readonly loadedPage: number
  readonly markedRead: boolean
  readonly persistentQueued: boolean
  readonly render: NotificationAcceptanceRenderReport
  readonly toastQueueSize: number
}
