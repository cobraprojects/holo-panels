import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import PostResource from '../PostResource'

export default class EditPost extends EditRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}
