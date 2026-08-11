import { VueActionRenderer, VueEntryRenderer } from '@holo-js/panels-vue'
import { createApp, createSSRApp, defineComponent, h, nextTick } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type {
  InfolistActionAcceptanceDriver,
  InfolistActionAcceptanceFixture,
  InfolistActionAcceptanceModel,
  InfolistActionAcceptanceRenderReport,
} from '../../../packages/testing/src/infolist-action-acceptance/index'

function component(model: InfolistActionAcceptanceModel) {
  return defineComponent(() => () => h('div', [
    ...model.entries.map(store => h(VueEntryRenderer, { entry: { action: model.entryAction, store }, key: store.snapshot.id })),
    h(VueActionRenderer, { action: model.actions.publish, recordIds: [42], store: model.actionStore }),
  ]))
}

function driver(container: HTMLDivElement, destroy: () => void): InfolistActionAcceptanceDriver {
  const required = <TElement extends Element>(selector: string): TElement => {
    const elements = container.querySelectorAll<TElement>(selector)
    const element = elements.item(elements.length - 1)
    if (!element) throw new Error(`Acceptance element "${selector}" was not rendered`)
    return element
  }
  const update = async (operation: () => Promise<void> | void): Promise<void> => {
    await operation()
    await nextTick()
  }
  return {
    clickText: text => update(() => {
      const element = Array.from(container.querySelectorAll('button')).find(button => button.textContent?.trim() === text)
      if (!element) throw new Error(`Acceptance button "${text}" was not rendered`)
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
    keydown: (selector, key) => update(() => { required<HTMLElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })) }),
    markup: () => container.innerHTML,
    sync: update,
  }
}

async function render(model: InfolistActionAcceptanceModel): Promise<string> {
  return renderToString(createSSRApp(component(model)))
}

export const nuxtInfolistActionAcceptanceFixture: InfolistActionAcceptanceFixture = {
  framework: 'vue',
  async mount(model) {
    const container = document.createElement('div')
    document.body.append(container)
    const app = createApp(component(model))
    app.mount(container)
    await nextTick()
    return driver(container, () => app.unmount())
  },
  async render(model): Promise<InfolistActionAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'vue', markup, ssrStable: markup === await render(model) }
  },
}
