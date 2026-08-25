import { CreateRecord } from '@holo-js/panels-resources'
import CommentResource from '../CommentResource'

export default class CreateComment extends CreateRecord {
  static override get resource() { return CommentResource }
}

