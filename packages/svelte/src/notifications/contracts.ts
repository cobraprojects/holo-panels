import type { ClientNotificationInboxState, ClientNotificationInboxStore, ClientToast, ClientToastStore } from '@holo-js/panels-client'
import type { SvelteComponentRegistry } from '../registry'

export type SvelteDatabaseNotification = ClientNotificationInboxState['items'][number]

export interface SvelteNotificationControls extends Record<string, unknown> {
  readonly delete: () => Promise<void>
  readonly markRead: () => Promise<void>
  readonly markUnread: () => Promise<void>
}

export interface SvelteCustomNotificationProps extends Record<string, unknown> {
  readonly controls: SvelteNotificationControls
  readonly notification: SvelteDatabaseNotification
}

export interface SvelteToastViewportProps extends Record<string, unknown> {
  readonly navigate?: (url: string) => void
  readonly placement?: 'bottom' | 'top'
  readonly store: ClientToastStore
}

export interface SvelteNotificationInboxProps extends Record<string, unknown> {
  readonly emptyMessage?: string
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly placement?: 'dropdown' | 'page' | 'sidebar'
  readonly registry?: SvelteComponentRegistry
  readonly store: ClientNotificationInboxStore
}

export interface SvelteNotificationInboxTriggerProps extends Record<string, unknown> {
  readonly emptyMessage?: string
  readonly label?: string
  readonly lazy?: boolean
  readonly navigate?: (url: string) => void
  readonly panelId?: string
  readonly placement: 'sidebar' | 'topbar'
  readonly registry?: SvelteComponentRegistry
  readonly store: ClientNotificationInboxStore
}

export type SvelteNotificationToast = ClientToast

export interface SvelteNotificationAction {
  readonly id: string
  readonly kind: 'dismiss' | 'mark-read' | 'mark-unread' | 'navigate'
  readonly label: string
  readonly url: string | null
}
