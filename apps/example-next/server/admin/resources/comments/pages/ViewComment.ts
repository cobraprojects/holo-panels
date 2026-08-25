import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import CommentResource from '../CommentResource'

export default class ViewComment extends ViewRecord {
  static override get resource() { return CommentResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

