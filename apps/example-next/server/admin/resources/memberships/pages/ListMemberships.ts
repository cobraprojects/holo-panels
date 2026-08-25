import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import MembershipResource from '../MembershipResource'

export default class ListMemberships extends ListRecords {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

