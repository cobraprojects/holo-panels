import { createServer, type ViteDevServer } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component } from 'svelte'
import type { render as RenderComponent } from 'svelte/server'
import type { ClientRelationManager, RelationAcceptanceFixture, RelationAcceptanceRenderReport } from '../../../packages/testing/src/relation-acceptance'

let server: ViteDevServer | undefined
let component: Component<{ managers: readonly ClientRelationManager[] }> | undefined
let renderComponent: typeof RenderComponent | undefined

async function render(managers: readonly ClientRelationManager[]): Promise<string> {
  if (!server) {
    server = await createServer({
      appType: 'custom',
      cacheDir: '/tmp/holo-panels-sveltekit-p10-acceptance',
      configFile: false,
      logLevel: 'silent',
      plugins: [svelte()],
      root: new URL('..', import.meta.url).pathname,
      server: { middlewareMode: true },
    })
    const fixture = await server.ssrLoadModule('/tests/P10RelationFixture.svelte')
    const svelteServer = await server.ssrLoadModule('svelte/server')
    component = fixture.default as Component<{ managers: readonly ClientRelationManager[] }>
    renderComponent = svelteServer.render as typeof RenderComponent
  }
  if (!component || !renderComponent) throw new Error('Svelte relation acceptance renderer is unavailable')
  return renderComponent(component, { props: { managers } }).body
}

export const svelteKitRelationAcceptanceFixture: RelationAcceptanceFixture = {
  framework: 'svelte',
  async render(managers): Promise<RelationAcceptanceRenderReport> {
    const markup = await render(managers)
    const repeat = await render(managers)
    await server?.close()
    server = undefined
    component = undefined
    renderComponent = undefined
    return { framework: 'svelte', markup, ssrStable: markup === repeat }
  },
}
