import { ViewRecord } from '@holo-js/panels-resources'
import CommentResource from '../CommentResource'

export default class ViewComment extends ViewRecord {
  static override get resource() { return CommentResource }

  protected override getHeaderActions() {
    return CommentResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

