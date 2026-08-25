import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import CommentResource from '../CommentResource'

export default class ListComments extends ListRecords {
  static override get resource() { return CommentResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

