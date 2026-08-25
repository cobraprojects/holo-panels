import { ListRecords } from '@holo-js/panels-resources'
import TagResource from '../TagResource'

export default class ListTags extends ListRecords {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return TagResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

