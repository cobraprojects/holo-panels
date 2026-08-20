import { EditRecord } from '@holo-js/panels-resources'
import PostResource from '../PostResource'

export default class EditPost extends EditRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(action => [action.view(), action.delete()])
  }
}
