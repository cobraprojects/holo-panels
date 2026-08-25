import { ListRecords } from '@holo-js/panels-resources'
import UserResource from '../UserResource'

export default class ListUsers extends ListRecords {
  static override get resource() { return UserResource }

  protected override getHeaderActions() {
    return UserResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

