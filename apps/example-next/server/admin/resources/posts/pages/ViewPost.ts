import { ViewRecord } from '@holo-js/panels-resources'
import PostResource from '../PostResource'

export default class ViewPost extends ViewRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ EditAction }) => [EditAction.make()])
  }
}
