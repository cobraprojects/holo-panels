import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import MembershipResource from '../MembershipResource'

export default class EditMembership extends EditRecord {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

