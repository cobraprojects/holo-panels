import { VueNavigationSearchRenderer } from '@holo-js/panels-vue'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { NavigationSearchAcceptanceFixture, NavigationSearchAcceptanceModel, NavigationSearchAcceptanceRenderReport } from '../../../packages/testing/src/navigation-search-acceptance'

async function render(model: NavigationSearchAcceptanceModel): Promise<string> {
  const component = defineComponent(() => () => h(VueNavigationSearchRenderer, { shell: model }))
  return renderToString(createSSRApp(component))
}

export const nuxtNavigationSearchAcceptanceFixture: NavigationSearchAcceptanceFixture = {
  framework: 'vue',
  async render(model): Promise<NavigationSearchAcceptanceRenderReport> {
    const markup = await render(model)
    return { framework: 'vue', markup, ssrStable: markup === await render(model) }
  },
}
