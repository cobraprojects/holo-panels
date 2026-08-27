import type {
  ClientNotificationInboxState,
  ClientNotificationInboxStore,
  ClientToast,
  ClientToastStore,
} from '@holo-js/panels-client'
import type { ComponentRegistry } from '../registry'

export type ReactDatabaseNotification = ClientNotificationInboxState['items'][number]

export interface ReactNotificationControls {
  readonly delete: () => Promise<void>
  readonly markRead: () => Promise<void>
  readonly markUnread: () => Promise<void>
}

export interface ReactCustomNotificationProps {
  readonly controls: ReactNotificationControls
  readonly notification: ReactDatabaseNotification
}

export interface ReactToastViewportProps {
  readonly panelId?: string
  readonly registry?: ComponentRegistry
  readonly navigate?: (url: string) => void
  readonly placement?: 'bottom' | 'top'
  readonly store: ClientToastStore
}

export interface ReactNotificationInboxProps {
  readonly emptyMessage?: string
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly placement?: 'dropdown' | 'page' | 'sidebar'
  readonly registry?: ComponentRegistry
  readonly store: ClientNotificationInboxStore
}

export interface ReactNotificationInboxTriggerProps extends Omit<ReactNotificationInboxProps, 'placement'> {
  readonly label?: string
  readonly lazy?: boolean
  readonly placement: 'sidebar' | 'topbar'
}

export type ReactNotificationToast = ClientToast
