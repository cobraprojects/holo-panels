import { ReactNavigationSearchRenderer } from '@holo-js/panels-react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { NavigationSearchAcceptanceFixture, NavigationSearchAcceptanceModel, NavigationSearchAcceptanceRenderReport } from '../../../packages/testing/src/navigation-search-acceptance'

function render(model: NavigationSearchAcceptanceModel): string {
  return renderToString(createElement(ReactNavigationSearchRenderer, model))
}

export const nextNavigationSearchAcceptanceFixture: NavigationSearchAcceptanceFixture = {
  framework: 'react',
  async render(model): Promise<NavigationSearchAcceptanceRenderReport> {
    const markup = render(model)
    return { framework: 'react', markup, ssrStable: markup === render(model) }
  },
}
