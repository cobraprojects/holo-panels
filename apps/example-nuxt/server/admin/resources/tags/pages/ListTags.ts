import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import TagResource from '../TagResource'

export default class ListTags extends ListRecords {
  static override get resource() { return TagResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

