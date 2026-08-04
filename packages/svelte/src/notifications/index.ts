import type { Component } from 'svelte'
import type { SvelteComponentRegistry } from '../registry'
import RawNotificationInbox from './NotificationInbox.svelte'
import RawNotificationInboxTrigger from './NotificationInboxTrigger.svelte'
import RawToastViewport from './ToastViewport.svelte'
import type { SvelteCustomNotificationProps, SvelteNotificationInboxProps, SvelteNotificationInboxTriggerProps, SvelteToastViewportProps } from './contracts'
import { svelteNotificationRendererName } from './helpers'

export const SvelteNotificationInbox: Component<SvelteNotificationInboxProps> = RawNotificationInbox
export const SvelteNotificationInboxTrigger: Component<SvelteNotificationInboxTriggerProps> = RawNotificationInboxTrigger
export const SvelteNotificationToastViewport: Component<SvelteToastViewportProps> = RawToastViewport
export const SvelteToastViewport: Component<SvelteToastViewportProps> = RawToastViewport

export { svelteNotificationRendererName } from './helpers'

export function registerSvelteNotificationRenderer(registry: SvelteComponentRegistry, type: string, component: Component<SvelteCustomNotificationProps>): SvelteComponentRegistry {
  registry.register({ component, source: '@holo-js/panels-svelte', typeId: svelteNotificationRendererName(type) })
  return registry
}

export type { SvelteCustomNotificationProps, SvelteDatabaseNotification, SvelteNotificationControls, SvelteNotificationInboxProps, SvelteNotificationInboxTriggerProps, SvelteNotificationToast, SvelteToastViewportProps } from './contracts'
