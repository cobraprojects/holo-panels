import { ComponentRegistry } from '../../../packages/react/src/registry'
import {
  ReactNotificationInbox,
  ReactToastViewport,
  registerReactNotificationRenderer,
  type ReactCustomNotificationProps,
} from '../../../packages/react/src/notifications'
import { createElement, Fragment } from 'react'
import { renderToString } from 'react-dom/server'
import type {
  NotificationAcceptanceFixture,
  NotificationAcceptanceModel,
  NotificationAcceptanceRenderReport,
} from '../../../packages/testing/src/notification-acceptance'

function ReleaseNotification({ notification }: ReactCustomNotificationProps): React.ReactNode {
  return createElement('article', { 'data-custom-notification': notification.type }, `Custom release: ${notification.presentation.title}`)
}

const registry = registerReactNotificationRenderer(new ComponentRegistry(), 'app.notifications.release', ReleaseNotification)

function render(model: NotificationAcceptanceModel): string {
  return renderToString(createElement(Fragment, null,
    createElement(ReactToastViewport, { placement: model.toastPlacement, store: model.toastStore }),
    createElement('aside', null, createElement(ReactNotificationInbox, {
      panelId: model.panelId,
      placement: model.inboxPlacement,
      registry,
      store: model.inboxStore,
    })),
  ))
}

export const nextNotificationAcceptanceFixture: NotificationAcceptanceFixture = {
  framework: 'react',
  async render(model): Promise<NotificationAcceptanceRenderReport> {
    const markup = render(model)
    return { framework: 'react', markup, ssrStable: markup === render(model) }
  },
}
