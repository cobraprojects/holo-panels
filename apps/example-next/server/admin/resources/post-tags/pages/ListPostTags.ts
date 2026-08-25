import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import PostTagResource from '../PostTagResource'

export default class ListPostTags extends ListRecords {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

