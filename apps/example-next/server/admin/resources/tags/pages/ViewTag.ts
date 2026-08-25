import { ViewRecord } from '@holo-js/panels-resources'
import TagResource from '../TagResource'

export default class ViewTag extends ViewRecord {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return TagResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

