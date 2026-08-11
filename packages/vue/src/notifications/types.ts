import type {
  ClientNotificationInboxState,
  ClientNotificationInboxStore,
  ClientToast,
  ClientToastStore,
} from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'

export type VueDatabaseNotification = ClientNotificationInboxState['items'][number]

export interface VueNotificationControls {
  readonly delete: () => Promise<void>
  readonly markRead: () => Promise<void>
  readonly markUnread: () => Promise<void>
}

export interface VueCustomNotificationProps {
  readonly controls: VueNotificationControls
  readonly notification: VueDatabaseNotification
}

export interface VueToastViewportProps {
  readonly navigate?: (url: string) => void
  readonly placement?: 'bottom' | 'top'
  readonly store: ClientToastStore
}

export interface VueNotificationInboxProps {
  readonly emptyMessage?: string
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly placement?: 'dropdown' | 'page' | 'sidebar'
  readonly registry?: ComponentRegistry
  readonly store: ClientNotificationInboxStore
}

export interface VueNotificationInboxTriggerProps extends Omit<VueNotificationInboxProps, 'placement'> {
  readonly label?: string
  readonly lazy?: boolean
  readonly placement: 'sidebar' | 'topbar'
}

export type VueNotificationToast = ClientToast
