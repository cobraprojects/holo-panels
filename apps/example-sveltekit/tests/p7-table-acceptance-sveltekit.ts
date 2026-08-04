import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { SvelteTableRenderer, type SvelteTableRendererProps } from '@holo-js/panels-svelte'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import type { Component, flushSync, mount, unmount } from 'svelte'
import type { render as RenderComponent } from 'svelte/server'
import { createServer, type ViteDevServer } from 'vite'
import type {
  TableAcceptanceDriver,
  TableAcceptanceFixture,
  TableAcceptanceModel,
  TableAcceptanceRenderReport,
} from '../../../packages/testing/src/table-acceptance/index'

let ssrServer: ViteDevServer | undefined
let serverComponent: Component<{ table: TableAcceptanceModel }> | undefined
let renderComponent: typeof RenderComponent | undefined

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

function driver(
  container: HTMLDivElement,
  update: (operation: () => void) => void,
  destroy: () => Promise<void>,
): TableAcceptanceDriver {
  const required = <TElement extends Element>(selector: string): TElement => {
    const element = container.querySelector<TElement>(selector)
    if (!element) throw new Error('Acceptance element "' + selector + '" was not rendered')
    return element
  }
  return {
    async click(selector) { update(() => required<HTMLElement>(selector).click()) },
    async clickText(value) {
      update(() => {
        const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === value)
        if (!element) throw new Error('Acceptance button "' + value + '" was not rendered')
        element.click()
      })
    },
    async dispose() {
      await destroy()
      container.remove()
    },
    async input(selector, value) {
      update(() => {
        const input = required<HTMLInputElement>(selector)
        input.value = value
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
    },
    async keydown(selector, key) {
      update(() => required<HTMLInputElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })))
    },
    markup: () => container.innerHTML,
    async select(selector, value) {
      update(() => {
        const select = required<HTMLSelectElement>(selector)
        select.value = value
        select.dispatchEvent(new Event('change', { bubbles: true }))
      })
    },
    async sync(operation) { update(operation) },
    async toggleColumn(label) {
      update(() => {
        const input = Array.from(container.querySelectorAll<HTMLInputElement>('.hp-column-manager input')).find(candidate => candidate.parentElement?.textContent?.trim() === label)
        if (!input) throw new Error('Acceptance column "' + label + '" was not rendered')
        input.click()
      })
    },
  }
}

function props(model: TableAcceptanceModel): SvelteTableRendererProps<Record<string, unknown>, number> {
  return model
}

async function render(model: TableAcceptanceModel): Promise<string> {
  if (!ssrServer) {
    ssrServer = await createServer({
      appType: 'custom',
      cacheDir: '/tmp/holo-panels-sveltekit-p7-acceptance',
      configFile: false,
      logLevel: 'silent',
      plugins: [svelte()],
      root: new URL('..', import.meta.url).pathname,
      server: { middlewareMode: true },
    })
    const fixture = await ssrServer.ssrLoadModule('/tests/p7-table-acceptance-ssr.svelte')
    const svelteServer = await ssrServer.ssrLoadModule('svelte/server')
    serverComponent = fixture.default as Component<{ table: TableAcceptanceModel }>
    renderComponent = svelteServer.render as typeof RenderComponent
  }
  if (!serverComponent || !renderComponent) throw new Error('Svelte acceptance SSR renderer is unavailable')
  return renderComponent(serverComponent, { props: { table: model } }).body
}

export const svelteKitTableAcceptanceFixture: TableAcceptanceFixture = {
  framework: 'svelte',
  async mount(model) {
    const client = await clientRuntime()
    const container = document.createElement('div')
    document.body.append(container)
    const component = client.mountComponent(SvelteTableRenderer, { props: { table: props(model) }, target: container })
    client.flush()
    return driver(
      container,
      operation => client.flush(operation),
      async () => {
        await client.unmountComponent(component)
        await ssrServer?.close()
        ssrServer = undefined
        serverComponent = undefined
        renderComponent = undefined
      },
    )
  },
  async render(model): Promise<TableAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'svelte', markup, ssrStable: markup === await render(model) }
  },
}
