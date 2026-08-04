import { VueRelationManagerRenderer } from '@holo-js/panels-vue'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import type { ClientRelationManager, RelationAcceptanceFixture, RelationAcceptanceRenderReport } from '../../../packages/testing/src/relation-acceptance'

async function render(managers: readonly ClientRelationManager[]): Promise<string> {
  const component = defineComponent(() => () => h(VueRelationManagerRenderer, { relations: { managers } }))
  return renderToString(createSSRApp(component))
}

export const nuxtRelationAcceptanceFixture: RelationAcceptanceFixture = {
  framework: 'vue',
  async render(managers): Promise<RelationAcceptanceRenderReport> {
    const markup = await render(managers)
    return { framework: 'vue', markup, ssrStable: markup === await render(managers) }
  },
}
