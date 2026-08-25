import { EditRecord } from '@holo-js/panels-resources'
import UserResource from '../UserResource'

export default class EditUser extends EditRecord {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return UserResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

