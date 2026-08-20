import { CreateRecord } from '@holo-js/panels-resources'
import PostResource from '../PostResource'

export default class CreatePost extends CreateRecord {
  static override get resource() { return PostResource }
}
