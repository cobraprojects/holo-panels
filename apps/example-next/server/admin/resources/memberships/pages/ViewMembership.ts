import { ViewRecord } from '@holo-js/panels-resources'
import MembershipResource from '../MembershipResource'

export default class ViewMembership extends ViewRecord {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return MembershipResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

