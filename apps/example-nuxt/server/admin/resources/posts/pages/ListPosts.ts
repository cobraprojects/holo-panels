import { ListRecords } from '@holo-js/panels-resources'
import PostResource from '../PostResource'

export default class ListPosts extends ListRecords {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}
