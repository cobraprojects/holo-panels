import { CreateRecord } from '@holo-js/panels-resources'
import UserResource from '../UserResource'

export default class CreateUser extends CreateRecord {
  static override get resource() { return UserResource }
}

