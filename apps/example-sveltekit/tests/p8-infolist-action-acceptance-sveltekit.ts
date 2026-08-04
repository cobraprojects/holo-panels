import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { EntryRenderer, SvelteActionRenderer } from '@holo-js/panels-svelte'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, mount, unmount } from 'svelte'
import type { render as RenderComponent } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import type {
  InfolistActionAcceptanceDriver,
  InfolistActionAcceptanceFixture,
  InfolistActionAcceptanceModel,
  InfolistActionAcceptanceRenderReport,
} from '../../../packages/testing/src/infolist-action-acceptance/index'

let ssrServer: ViteDevServer | undefined
let renderComponent: typeof RenderComponent | undefined
let serverEntryRenderer: Component | undefined
let serverActionRenderer: Component | undefined

async function clientRuntime(): Promise<{
  readonly flush: typeof flushSync
  readonly mountComponent: typeof mount
  readonly unmountComponent: typeof unmount
}> {
  const require = createRequire(import.meta.url)
  const sveltePackage = require.resolve('svelte/package.json')
  const client = await import(pathToFileURL(resolve(dirname(sveltePackage), 'src/index-client.js')).href)
  return {
    flush: client.flushSync as typeof flushSync,
    mountComponent: client.mount as typeof mount,
    unmountComponent: client.unmount as typeof unmount,
  }
}

function driver(container: HTMLDivElement, update: (operation: () => Promise<void> | void) => Promise<void>, destroy: () => Promise<void>): InfolistActionAcceptanceDriver {
  const required = <TElement extends Element>(selector: string): TElement => {
    const elements = container.querySelectorAll<TElement>(selector)
    const element = elements.item(elements.length - 1)
    if (!element) throw new Error(`Acceptance element "${selector}" was not rendered`)
    return element
  }
  return {
    clickText: text => update(() => {
      const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === text)
      if (!element) throw new Error(`Acceptance button "${text}" was not rendered`)
      element.click()
    }),
    async dispose() {
      await destroy()
      container.remove()
    },
    input: (selector, value) => update(() => {
      const input = required<HTMLInputElement>(selector)
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }),
    keydown: (selector, key) => update(() => { required<HTMLElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })) }),
    markup: () => container.innerHTML,
    sync: update,
  }
}

async function render(model: InfolistActionAcceptanceModel): Promise<string> {
  if (!ssrServer) {
    const rendererRoot = fileURLToPath(new URL('../../../packages/svelte', import.meta.url))
    ssrServer = await createServer({
      appType: 'custom',
      cacheDir: '/tmp/holo-panels-sveltekit-p8-acceptance',
      configFile: false,
      logLevel: 'silent',
      plugins: [svelte()],
      root: rendererRoot,
      server: { middlewareMode: true },
    })
    const renderers = await ssrServer.ssrLoadModule('/src/index.ts')
    const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
    serverEntryRenderer = renderers.EntryRenderer as Component
    serverActionRenderer = renderers.SvelteActionRenderer as Component
    renderComponent = svelteServer.render as typeof RenderComponent
  }
  if (!serverEntryRenderer || !serverActionRenderer || !renderComponent) throw new Error('Svelte P8 acceptance SSR renderer is unavailable')
  const entries = model.entries.map(store => renderComponent?.(serverEntryRenderer as Component, { props: { action: model.entryAction, store } }).body)
  const action = renderComponent(serverActionRenderer, { props: { action: model.actions.publish, recordIds: [42], store: model.actionStore } }).body
  return `${entries.join('')}${action}`
}

export const svelteKitInfolistActionAcceptanceFixture: InfolistActionAcceptanceFixture = {
  framework: 'svelte',
  async mount(model) {
    const client = await clientRuntime()
    const container = document.createElement('div')
    document.body.append(container)
    const entryComponents = model.entries.map(store => client.mountComponent(EntryRenderer, { props: { action: model.entryAction, store }, target: container }))
    const actionComponent = client.mountComponent(SvelteActionRenderer, { props: { action: model.actions.publish, recordIds: [42], store: model.actionStore }, target: container })
    client.flush()
    return driver(
      container,
      async operation => {
        let result: Promise<void> | void = undefined
        client.flush(() => { result = operation() })
        await result
        client.flush()
      },
      async () => {
        await client.unmountComponent(actionComponent)
        for (const component of entryComponents) await client.unmountComponent(component)
        await ssrServer?.close()
        ssrServer = undefined
        serverEntryRenderer = undefined
        serverActionRenderer = undefined
        renderComponent = undefined
      },
    )
  },
  async render(model): Promise<InfolistActionAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'svelte', markup, ssrStable: markup === await render(model) }
  },
}
