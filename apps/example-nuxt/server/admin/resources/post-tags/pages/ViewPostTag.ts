import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import PostTagResource from '../PostTagResource'

export default class ViewPostTag extends ViewRecord {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

