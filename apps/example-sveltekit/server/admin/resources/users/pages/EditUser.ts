import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import UserResource from '../UserResource'

export default class EditUser extends EditRecord {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

