import { CreateRecord } from '@holo-js/panels-resources'
import MembershipResource from '../MembershipResource'

export default class CreateMembership extends CreateRecord {
  static override get resource() { return MembershipResource }
}

