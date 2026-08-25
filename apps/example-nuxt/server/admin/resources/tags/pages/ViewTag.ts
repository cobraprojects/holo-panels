import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import TagResource from '../TagResource'

export default class ViewTag extends ViewRecord {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

