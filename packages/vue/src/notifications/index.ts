import type { Component } from 'vue'
import type { ComponentRegistry } from '../registry'
import { vueNotificationRendererName } from './renderer'

export { VueNotificationInbox, VueToastViewport, vueNotificationRendererName } from './renderer'
export { VueNotificationInboxTrigger } from './trigger'

export function registerVueNotificationRenderer(registry: ComponentRegistry, type: string, component: Component): ComponentRegistry {
  return registry.register(vueNotificationRendererName(type), component, '@holo-js/panels-vue')
}
export type {
  VueCustomNotificationProps,
  VueDatabaseNotification,
  VueNotificationControls,
  VueNotificationInboxProps,
  VueNotificationInboxTriggerProps,
  VueNotificationToast,
  VueToastViewportProps,
} from './types'
