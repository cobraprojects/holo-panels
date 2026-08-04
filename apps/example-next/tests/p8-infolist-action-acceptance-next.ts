import { createElement, Fragment } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { ReactActionRenderer, ReactEntryRenderer } from '@holo-js/panels-react'
import type {
  InfolistActionAcceptanceDriver,
  InfolistActionAcceptanceFixture,
  InfolistActionAcceptanceModel,
  InfolistActionAcceptanceRenderReport,
} from '../../../packages/testing/src/infolist-action-acceptance/index'

function view(model: InfolistActionAcceptanceModel) {
  return createElement(Fragment, null,
    ...model.entries.map(store => createElement(ReactEntryRenderer, { action: model.entryAction, key: store.snapshot.id, store })),
    createElement(ReactActionRenderer<string>, { manifest: model.actions.publish, recordIds: [42], store: model.actionStore }),
  )
}

function driver(container: HTMLDivElement, destroy: () => Promise<void>): InfolistActionAcceptanceDriver {
  const required = <TElement extends Element>(selector: string): TElement => {
    const element = container.querySelector<TElement>(selector)
    if (!element) throw new Error(`Acceptance element "${selector}" was not rendered`)
    return element
  }
  const update = async (operation: () => Promise<void> | void): Promise<void> => act(async () => operation())
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
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }),
    keydown: (selector, key) => update(() => { required<HTMLElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key })) }),
    markup: () => container.innerHTML,
    sync: update,
  }
}

function render(model: InfolistActionAcceptanceModel): string {
  return renderToString(view(model))
}

export const nextInfolistActionAcceptanceFixture: InfolistActionAcceptanceFixture = {
  framework: 'react',
  async mount(model) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(view(model)))
    return driver(container, async () => act(async () => root.unmount()))
  },
  async render(model): Promise<InfolistActionAcceptanceRenderReport> {
    const markup = render(model)
    return { framework: 'react', markup, ssrStable: markup === render(model) }
  },
}
