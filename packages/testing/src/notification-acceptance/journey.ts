import {
  ClientNotificationInboxStore,
  ClientToastStore,
  type ClientNotificationTransport,
} from '@holo-js/panels-client'
import {
  panelNotification,
  type PanelDatabaseNotificationItem,
  type PanelDatabaseNotificationPage,
} from '@holo-js/panels-core'
import type {
  NotificationAcceptanceFixture,
  NotificationAcceptanceJourneyReport,
  NotificationAcceptanceModel,
} from './contracts'

function item(id: string, type: string, read: boolean): PanelDatabaseNotificationItem {
  const presentation = panelNotification(`acceptance-${id}`)
    .title(id === 'release' ? 'Release deployed' : `Notification ${id}`)
    .body(id === 'release' ? 'Version 2.0 is live' : 'Review this notification')
    .icon('bell')
    .action('read', 'Acknowledge', 'mark-read')
    .action('remove', 'Remove', 'dismiss')
    .action('open', 'Open notification', 'navigate', `/admin/notifications/${id}`)
    .presentation()
  return {
    createdAt: `2026-07-28T10:0${id === 'release' ? '3' : id}:00.000Z`,
    id,
    presentation,
    read,
    type,
  }
}

function page(records: readonly PanelDatabaseNotificationItem[], requestedPage: number, pageSize: number): PanelDatabaseNotificationPage {
  const start = (requestedPage - 1) * pageSize
  return {
    items: records.slice(start, start + pageSize),
    page: requestedPage,
    pageSize,
    total: records.length,
    unread: records.filter(record => !record.read).length,
  }
}

async function acceptanceModel(): Promise<{
  readonly actions: string[]
  readonly deleted: string[]
  readonly markedRead: string[]
  readonly model: NotificationAcceptanceModel
}> {
  const actions: string[] = []
  const deleted: string[] = []
  const markedRead: string[] = []
  const toastStore = new ClientToastStore()
  toastStore.onAction(action => { actions.push(action.id) })
  toastStore.push(panelNotification('draft-saved').title('Draft saved').body('Your changes are safe').status('success').duration(30_000).presentation())
  const deployment = panelNotification('deployment-ready')
    .title('Deployment ready')
    .body('Production can be opened')
    .persistent()
    .action('open-deployment', 'Open deployment', 'navigate', '/admin/deployments/2')
    .presentation()
  toastStore.push(deployment)
  toastStore.push(deployment)
  await toastStore.trigger('deployment-ready', 'open-deployment')

  let records = [
    item('release', 'app.notifications.release', false),
    item('2', 'audit', true),
    item('3', 'audit', false),
  ]
  const transport: ClientNotificationTransport = {
    async delete(ids) {
      deleted.push(...ids)
      const selected = new Set(ids)
      const previous = records.length
      records = records.filter(record => !selected.has(record.id))
      return previous - records.length
    },
    async list(requestedPage, pageSize) {
      return page(records, requestedPage, pageSize)
    },
    async markRead(ids) {
      markedRead.push(...ids)
      const selected = new Set(ids)
      records = records.map(record => selected.has(record.id) ? { ...record, read: true } : record)
      return ids.length
    },
    async markUnread(ids) {
      const selected = new Set(ids)
      records = records.map(record => selected.has(record.id) ? { ...record, read: false } : record)
      return ids.length
    },
  }
  const inboxStore = new ClientNotificationInboxStore({ pageSize: 2, polling: false, transport })
  await inboxStore.start()
  return {
    actions,
    deleted,
    markedRead,
    model: { inboxPlacement: 'sidebar', inboxStore, panelId: 'admin', toastPlacement: 'bottom', toastStore },
  }
}

export async function runNotificationAcceptanceJourney(fixture: NotificationAcceptanceFixture): Promise<NotificationAcceptanceJourneyReport> {
  const acceptance = await acceptanceModel()
  const render = await fixture.render(acceptance.model)
  const toastQueueSize = acceptance.model.toastStore.state.items.length
  const persistentQueued = acceptance.model.toastStore.state.items.some(toast => toast.id === 'deployment-ready' && toast.persistent)
  await acceptance.model.inboxStore.load(2)
  const loadedPage = acceptance.model.inboxStore.state.page
  await acceptance.model.inboxStore.markRead(['3'])
  await acceptance.model.inboxStore.delete(['3'])
  const report: NotificationAcceptanceJourneyReport = {
    actionObserved: acceptance.actions[0] ?? '',
    deleted: acceptance.deleted.includes('3'),
    framework: fixture.framework,
    loadedPage,
    markedRead: acceptance.markedRead.includes('3'),
    persistentQueued,
    render,
    toastQueueSize,
  }
  acceptance.model.inboxStore.dispose()
  acceptance.model.toastStore.dispose()
  return report
}
