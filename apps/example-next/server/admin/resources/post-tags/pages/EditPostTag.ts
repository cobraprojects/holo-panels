import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import PostTagResource from '../PostTagResource'

export default class EditPostTag extends EditRecord {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

