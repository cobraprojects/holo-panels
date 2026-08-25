import { EditRecord } from '@holo-js/panels-resources'
import CommentResource from '../CommentResource'

export default class EditComment extends EditRecord {
  static override get resource() { return CommentResource }

  protected override getHeaderActions() {
    return CommentResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

