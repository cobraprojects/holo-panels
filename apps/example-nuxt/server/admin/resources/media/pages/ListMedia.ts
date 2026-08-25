import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import MediaResource from '../MediaResource'

export default class ListMedia extends ListRecords {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

