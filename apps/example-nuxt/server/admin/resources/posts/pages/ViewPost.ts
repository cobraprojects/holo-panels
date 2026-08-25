import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import PostResource from '../PostResource'

export default class ViewPost extends ViewRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}
