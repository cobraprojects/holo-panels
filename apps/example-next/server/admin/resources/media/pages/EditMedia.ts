import { EditRecord } from '@holo-js/panels-resources'
import MediaResource from '../MediaResource'

export default class EditMedia extends EditRecord {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return MediaResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

