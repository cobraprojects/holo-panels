import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component } from 'svelte'
import type { render as RenderComponent } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import type {
  NotificationAcceptanceFixture,
  NotificationAcceptanceModel,
  NotificationAcceptanceRenderReport,
} from '../../../packages/testing/src/notification-acceptance'

let server: ViteDevServer | undefined
let component: Component<{ model: NotificationAcceptanceModel }> | undefined
let renderComponent: typeof RenderComponent | undefined

async function render(model: NotificationAcceptanceModel): Promise<string> {
  if (!server) {
    server = await createServer({ appType: 'custom', cacheDir: '/tmp/holo-panels-sveltekit-p13-acceptance', configFile: false, logLevel: 'silent', plugins: [svelte()], root: new URL('..', import.meta.url).pathname, server: { middlewareMode: true } })
    const fixture = await server.ssrLoadModule('/tests/P13NotificationFixture.svelte')
    const svelteServer = await server.ssrLoadModule('svelte/server')
    component = fixture.default as Component<{ model: NotificationAcceptanceModel }>
    renderComponent = svelteServer.render as typeof RenderComponent
  }
  if (!component || !renderComponent) throw new Error('Svelte notification acceptance renderer is unavailable')
  return renderComponent(component, { props: { model } }).body
}

export const svelteKitNotificationAcceptanceFixture: NotificationAcceptanceFixture = {
  framework: 'svelte',
  async render(model): Promise<NotificationAcceptanceRenderReport> {
    const markup = await render(model)
    const repeat = await render(model)
    await server?.close()
    server = undefined
    component = undefined
    renderComponent = undefined
    return { framework: 'svelte', markup, ssrStable: markup === repeat }
  },
}
