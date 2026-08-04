import { createExtensionTypeId, defineCustomPage } from '@holo-js/panels-core'

export const insightsPageType = createExtensionTypeId('acme.catalog', 'page', 'insights')

export const insightsPage = defineCustomPage('product-insights', { load: async () => ({ featured: 12, reviewed: 48 }) })
  .path('/products/insights')
  .title('Product insights')
  .renderer(insightsPageType, { density: 'comfortable' })
  .navigation({ icon: 'chart-bar', label: 'Product insights', sort: 20 })
