import { EditRecord } from '@holo-js/panels-resources'
import TagResource from '../TagResource'

export default class EditTag extends EditRecord {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return TagResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

