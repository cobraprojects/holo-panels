import { ViewRecord } from '@holo-js/panels-resources'
import PostTagResource from '../PostTagResource'

export default class ViewPostTag extends ViewRecord {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return PostTagResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

