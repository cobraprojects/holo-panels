import { ComponentRegistry } from '../../../packages/vue/src/registry'
import {
  VueNotificationInbox,
  VueToastViewport,
  registerVueNotificationRenderer,
  type VueCustomNotificationProps,
} from '../../../packages/vue/src/notifications'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type {
  NotificationAcceptanceFixture,
  NotificationAcceptanceModel,
  NotificationAcceptanceRenderReport,
} from '../../../packages/testing/src/notification-acceptance'

const ReleaseNotification = defineComponent({
  name: 'ReleaseNotification',
  props: { notification: { required: true, type: Object } },
  setup(props: { readonly notification: VueCustomNotificationProps['notification'] }) {
    return () => h('article', { 'data-custom-notification': props.notification.type }, `Custom release: ${props.notification.presentation.title}`)
  },
})

const registry = registerVueNotificationRenderer(new ComponentRegistry(), 'app.notifications.release', ReleaseNotification)

async function render(model: NotificationAcceptanceModel): Promise<string> {
  const component = defineComponent(() => () => h('div', [
    h(VueToastViewport, { placement: model.toastPlacement, store: model.toastStore }),
    h('aside', [h(VueNotificationInbox, {
      panelId: model.panelId,
      placement: model.inboxPlacement,
      registry,
      store: model.inboxStore,
    })]),
  ]))
  return renderToString(createSSRApp(component))
}

export const nuxtNotificationAcceptanceFixture: NotificationAcceptanceFixture = {
  framework: 'vue',
  async render(model): Promise<NotificationAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'vue', markup, ssrStable: markup === await render(model) }
  },
}
