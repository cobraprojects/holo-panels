import { ListRecords } from '@holo-js/panels-resources'
import { CreateAction } from '@holo-js/panels-actions'
import CategoryResource from '../CategoryResource'

export default class ListCategories extends ListRecords {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return [CreateAction.make()]
  }
}

