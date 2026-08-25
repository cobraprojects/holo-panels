import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import MembershipResource from '../MembershipResource'

export default class ViewMembership extends ViewRecord {
  static override get resource() { return MembershipResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

