import { defineCustomWidget } from '@holo-js/panels'

export default defineCustomWidget('content-notice')
  .heading('Publishing note')
  .columnSpan('full')
  .sort(1)
  .lazy()
  .poll(3000)
  .data(context => ({
    component: 'app.widgets.admin-content-notice',
    properties: { message: context.filters.search ? `Publishing search: ${String(context.filters.search)}` : 'All publishing records', detail: 'Changes use the shared resource authorization and table actions.' },
  }))
