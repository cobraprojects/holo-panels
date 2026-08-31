import { defineDashboard, Schema, TextInput } from '@holo-js/panels'

export default defineDashboard('metrics')
  .path('/admin/metrics')
  .navigation('Metrics', { sort: 2 })
  .filtersForm(new Schema().components([TextInput.make('search').label('Search posts').default('')]).compile())
  .persistFiltersInSession()
  .widgets('filtered-publishing', 'publishing-chart')
