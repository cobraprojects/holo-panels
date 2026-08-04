import type { ComponentType } from 'react'
import type { ComponentRegistry } from '../registry'
import { reactNotificationRendererName } from './renderer'
import type { ReactCustomNotificationProps } from './types'

export { ReactNotificationInbox, ReactToastViewport, reactNotificationRendererName } from './renderer'
export { ReactNotificationInboxTrigger } from './trigger'

export function registerReactNotificationRenderer(registry: ComponentRegistry, type: string, component: ComponentType<ReactCustomNotificationProps>): ComponentRegistry {
  return registry.register(reactNotificationRendererName(type), component, '@holo-js/panels-react')
}
export type {
  ReactCustomNotificationProps,
  ReactDatabaseNotification,
  ReactNotificationControls,
  ReactNotificationInboxProps,
  ReactNotificationInboxTriggerProps,
  ReactNotificationToast,
  ReactToastViewportProps,
} from './types'
