import { CreateRecord } from '@holo-js/panels-resources'
import TagResource from '../TagResource'

export default class CreateTag extends CreateRecord {
  static override get resource() { return TagResource }
}

