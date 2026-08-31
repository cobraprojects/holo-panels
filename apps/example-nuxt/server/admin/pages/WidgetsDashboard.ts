import { defineDashboard, Schema, TextInput } from '@holo-js/panels'

export default defineDashboard('widgets')
  .path('/admin/widgets')
  .navigation('Widgets', { sort: 4 })
  .filtersForm(new Schema().components([TextInput.make('search').label('Search posts').default('')]).compile())
  .persistFiltersInSession()
  .widgets('recent-posts', 'content-notice')
