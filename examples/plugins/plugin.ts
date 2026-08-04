import { definePanelPlugin } from '@holo-js/panels/plugin'
import { featureActionType } from './custom-action'
import { ratingColumnType } from './custom-column'
import { ratingEntryType } from './custom-entry'
import { ratingFieldType } from './custom-field'
import { ratingFilterType } from './custom-filter'
import { insightsPage, insightsPageType } from './custom-page'
import { ratingWidget, ratingWidgetType } from './custom-widget'

export const compatibility = Object.freeze({
  panels: Object.freeze({ minimum: '0.0.0' }),
  protocol: Object.freeze({ maximumExclusive: '2.0', minimum: '1.0' }),
})

export const catalogPlugin = definePanelPlugin({
  compatibility,
  id: 'acme.catalog',
  packageName: '@acme/panels-plugin-catalog',
})
  .pages(insightsPage.compile())
  .widgets(ratingWidget.compile())
  .extension({ compatibility, kind: 'field', pluginId: 'acme.catalog', typeId: ratingFieldType })
  .extension({ compatibility, kind: 'column', pluginId: 'acme.catalog', typeId: ratingColumnType })
  .extension({ compatibility, kind: 'entry', pluginId: 'acme.catalog', typeId: ratingEntryType })
  .extension({ compatibility, kind: 'filter', pluginId: 'acme.catalog', typeId: ratingFilterType })
  .extension({ compatibility, kind: 'action', pluginId: 'acme.catalog', typeId: featureActionType })
  .extension({ compatibility, kind: 'widget', pluginId: 'acme.catalog', typeId: ratingWidgetType })
  .extension({ compatibility, kind: 'page', pluginId: 'acme.catalog', typeId: insightsPageType })
  .renderer({ exportName: 'RatingField', framework: 'react', module: './renderers', typeId: ratingFieldType })
  .renderer({ exportName: 'RatingColumn', framework: 'react', module: './renderers', typeId: ratingColumnType })
  .renderer({ exportName: 'RatingEntry', framework: 'react', module: './renderers', typeId: ratingEntryType })
  .renderer({ exportName: 'RatingFilter', framework: 'react', module: './renderers', typeId: ratingFilterType })
  .renderer({ exportName: 'FeatureAction', framework: 'react', module: './renderers', typeId: featureActionType })
  .renderer({ exportName: 'RatingWidget', framework: 'react', module: './renderers', typeId: ratingWidgetType })
  .renderer({ exportName: 'InsightsPage', framework: 'react', module: './renderers', typeId: insightsPageType })
  .translation({
    catalog: {
      feature: 'Feature',
      insights: 'Product insights',
      rating: 'Rating',
    },
    locale: 'en',
    namespace: 'acme.catalog',
  })
  .asset({ id: 'catalog-style', kind: 'style', load: 'eager', source: './style.css' })
