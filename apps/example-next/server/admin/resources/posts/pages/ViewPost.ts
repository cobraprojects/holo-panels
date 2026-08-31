import { ViewRecord } from '@holo-js/panels-resources'
import PostResource from '../PostResource'
import { defineResourceCustomWidget, defineResourceTableWidget } from '@holo-js/panels'
import Post from '../../../../models/Post'

export default class ViewPost extends ViewRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ EditAction }) => [EditAction.make()])
  }

  protected override getFooterWidgets() {
    return [
      defineResourceTableWidget('record-posts', { record: Post }).table(PostResource).heading('More posts').columnSpan('full').lazy(),
      defineResourceCustomWidget('record-context', { record: Post }).heading('Publishing context').columnSpan('full')
        .data(context => ({ component: 'app.widgets.admin-content-notice', properties: { message: `Publishing record: ${context.resource?.record?.title ?? ''}`, detail: 'Only authorized resource data reaches this widget.' } })),
    ]
  }
}
