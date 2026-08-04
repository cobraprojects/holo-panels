import { ReactRelationManagerRenderer } from '@holo-js/panels-react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { ClientRelationManager, RelationAcceptanceFixture, RelationAcceptanceRenderReport } from '../../../packages/testing/src/relation-acceptance'

function render(managers: readonly ClientRelationManager[]): string {
  return renderToString(createElement(ReactRelationManagerRenderer, { managers }))
}

export const nextRelationAcceptanceFixture: RelationAcceptanceFixture = {
  framework: 'react',
  async render(managers): Promise<RelationAcceptanceRenderReport> {
    const markup = render(managers)
    return { framework: 'react', markup, ssrStable: markup === render(managers) }
  },
}
