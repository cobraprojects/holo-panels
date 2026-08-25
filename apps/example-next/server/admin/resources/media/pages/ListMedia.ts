import { ListRecords } from '@holo-js/panels-resources'
import MediaResource from '../MediaResource'

export default class ListMedia extends ListRecords {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return MediaResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

