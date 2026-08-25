import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import UserResource from '../UserResource'

export default class ViewUser extends ViewRecord {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

