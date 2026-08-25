import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import MediaResource from '../MediaResource'

export default class EditMedia extends EditRecord {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

