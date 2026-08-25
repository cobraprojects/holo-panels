import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import PostResource from '../PostResource'

export default class ListPosts extends ListRecords {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}
