import { ListRecords } from '@holo-js/panels-resources'
import MembershipResource from '../MembershipResource'

export default class ListMemberships extends ListRecords {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return MembershipResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

