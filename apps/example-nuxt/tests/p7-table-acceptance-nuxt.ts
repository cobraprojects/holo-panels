import { VueTableRenderer, type VueTableRendererProps } from '@holo-js/panels-vue'
import { createApp, createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type {
  TableAcceptanceDriver,
  TableAcceptanceFixture,
  TableAcceptanceModel,
  TableAcceptanceRenderReport,
} from '../../../packages/testing/src/table-acceptance/index'

function driver(
  container: HTMLDivElement,
  update: (operation: () => void) => Promise<void>,
  destroy: () => void,
): TableAcceptanceDriver {
  const required = <TElement extends Element>(selector: string): TElement => {
    const element = container.querySelector<TElement>(selector)
    if (!element) throw new Error('Acceptance element "' + selector + '" was not rendered')
    return element
  }
  return {
    click: selector => update(() => required<HTMLElement>(selector).click()),
    clickText: value => update(() => {
      const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === value)
      if (!element) throw new Error('Acceptance button "' + value + '" was not rendered')
      element.click()
    }),
    async dispose() {
      destroy()
      container.remove()
    },
    input: (selector, value) => update(() => {
      const input = required<HTMLInputElement>(selector)
      input.value = value
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }),
    keydown: (selector, key) => update(() => required<HTMLInputElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))),
    markup: () => container.innerHTML,
    select: (selector, value) => update(() => {
      const select = required<HTMLSelectElement>(selector)
      select.value = value
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }),
    sync: update,
    toggleColumn: label => update(() => {
      const item = Array.from(document.body.querySelectorAll<HTMLElement>('label, [role="menuitemcheckbox"]')).find(candidate => candidate.textContent?.trim() === label)
      if (!item) throw new Error('Acceptance column "' + label + '" was not rendered')
      item.click()
    }),
  }
}

function props(model: TableAcceptanceModel): VueTableRendererProps<Record<string, unknown>, number> {
  return model
}

function component(model: TableAcceptanceModel) {
  return defineComponent(() => () => h(VueTableRenderer, { table: props(model) }))
}

async function render(model: TableAcceptanceModel): Promise<string> {
  return renderToString(createSSRApp(component(model)))
}

export const nuxtTableAcceptanceFixture: TableAcceptanceFixture = {
  framework: 'vue',
  async mount(model) {
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(component(model))
    app.mount(container)
    await nextTick()
    return driver(
      container,
      async operation => {
        operation()
        await nextTick()
      },
      () => app.unmount(),
    )
  },
  async render(model): Promise<TableAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'vue', markup, ssrStable: markup === await render(model) }
  },
}
