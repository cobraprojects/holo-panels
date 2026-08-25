import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import UserResource from '../UserResource'

export default class ListUsers extends ListRecords {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

