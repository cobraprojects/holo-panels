import { EditRecord } from '@holo-js/panels-resources'
import PostTagResource from '../PostTagResource'

export default class EditPostTag extends EditRecord {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return PostTagResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

