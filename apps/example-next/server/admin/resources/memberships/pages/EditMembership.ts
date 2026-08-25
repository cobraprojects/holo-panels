import { EditRecord } from '@holo-js/panels-resources'
import MembershipResource from '../MembershipResource'

export default class EditMembership extends EditRecord {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return MembershipResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

