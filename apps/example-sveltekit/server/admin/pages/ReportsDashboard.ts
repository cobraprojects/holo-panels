import { defineDashboard } from '@holo-js/panels'

export default defineDashboard('reports')
  .path('/admin/reports')
  .navigation('Reports', { sort: 3 })
  .widgets('publishing-chart')
