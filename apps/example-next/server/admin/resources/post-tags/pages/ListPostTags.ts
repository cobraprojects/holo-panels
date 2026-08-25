import { ListRecords } from '@holo-js/panels-resources'
import PostTagResource from '../PostTagResource'

export default class ListPostTags extends ListRecords {
  static override get resource() { return PostTagResource }

  protected override getHeaderActions() {
    return PostTagResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

