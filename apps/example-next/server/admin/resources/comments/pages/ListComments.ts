import { ListRecords } from '@holo-js/panels-resources'
import CommentResource from '../CommentResource'

export default class ListComments extends ListRecords {
  static override get resource() { return CommentResource }

  protected override getHeaderActions() {
    return CommentResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

