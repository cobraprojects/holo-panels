import { ViewRecord } from '@holo-js/panels-resources'
import UserResource from '../UserResource'

export default class ViewUser extends ViewRecord {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return UserResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

