import { ListRecords } from '@holo-js/panels-resources'
import CategoryResource from '../CategoryResource'

export default class ListCategories extends ListRecords {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return CategoryResource.actions(({ CreateAction }) => [CreateAction.make()])
  }
}

