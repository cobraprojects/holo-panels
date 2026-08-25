import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import TagResource from '../TagResource'

export default class EditTag extends EditRecord {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

