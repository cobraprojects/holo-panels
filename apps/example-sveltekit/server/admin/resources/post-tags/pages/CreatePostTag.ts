import { CreateRecord } from '@holo-js/panels-resources'
import PostTagResource from '../PostTagResource'

export default class CreatePostTag extends CreateRecord {
  static override get resource() { return PostTagResource }
}

