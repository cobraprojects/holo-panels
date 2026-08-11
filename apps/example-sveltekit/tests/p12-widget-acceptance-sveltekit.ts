import { resolve } from 'node:path'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component } from 'svelte'
import type { render as RenderComponent } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import type { WidgetAcceptanceFixture, WidgetAcceptanceModel, WidgetAcceptanceRenderReport } from '../../../packages/testing/src/widget-acceptance'

let server: ViteDevServer | undefined
let component: Component<{ model: WidgetAcceptanceModel }> | undefined
let renderComponent: typeof RenderComponent | undefined

async function render(model: WidgetAcceptanceModel): Promise<string> {
  if (!server) {
    server = await createServer({ appType: 'custom', cacheDir: '/tmp/holo-panels-sveltekit-p12-acceptance', configFile: false, logLevel: 'silent', plugins: [svelte()], root: resolve(process.cwd(), '../../apps/example-sveltekit'), server: { middlewareMode: true } })
    const fixture = await server.ssrLoadModule('/tests/P12WidgetFixture.svelte')
    const svelteServer = await server.ssrLoadModule('svelte/server')
    component = fixture.default as Component<{ model: WidgetAcceptanceModel }>
    renderComponent = svelteServer.render as typeof RenderComponent
  }
  if (!component || !renderComponent) throw new Error('Svelte widget acceptance renderer is unavailable')
  return renderComponent(component, { props: { model } }).body
}

export const svelteKitWidgetAcceptanceFixture: WidgetAcceptanceFixture = {
  framework: 'svelte',
  async render(model): Promise<WidgetAcceptanceRenderReport> {
    const markup = await render(model)
    const repeat = await render(model)
    await server?.close()
    server = undefined
    component = undefined
    renderComponent = undefined
    return { framework: 'svelte', markup, ssrStable: markup === repeat }
  },
}
