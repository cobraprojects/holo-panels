import { createElement } from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { ReactTableRenderer, type ReactTableRendererProps } from '@holo-js/panels-react'
import type {
  TableAcceptanceDriver,
  TableAcceptanceFixture,
  TableAcceptanceModel,
  TableAcceptanceRenderReport,
} from '../../../packages/testing/src/table-acceptance/index'

function driver(
  container: HTMLDivElement,
  update: (operation: () => void) => Promise<void>,
  destroy: () => Promise<void>,
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
      await destroy()
      container.remove()
    },
    input: (selector, value) => update(() => {
      const input = required<HTMLInputElement>(selector)
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }),
    keydown: (selector, key) => update(() => {
      required<HTMLInputElement>(selector).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key }))
    }),
    markup: () => container.innerHTML,
    select: (selector, value) => update(() => {
      const select = required<HTMLSelectElement>(selector)
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set?.call(select, value)
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

function props(model: TableAcceptanceModel): ReactTableRendererProps<Record<string, unknown>, number> {
  return model
}

function render(model: TableAcceptanceModel): string {
  return renderToString(createElement(ReactTableRenderer<Record<string, unknown>, number>, props(model)))
}

export const nextTableAcceptanceFixture: TableAcceptanceFixture = {
  framework: 'react',
  async mount(model) {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)
    await act(async () => root.render(createElement(ReactTableRenderer<Record<string, unknown>, number>, props(model))))
    return driver(
      container,
      async operation => act(async () => operation()),
      async () => act(async () => root.unmount()),
    )
  },
  async render(model): Promise<TableAcceptanceRenderReport> {
    const markup = render(model)
    return { framework: 'react', markup, ssrStable: markup === render(model) }
  },
}
