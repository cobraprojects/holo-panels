import { EditRecord } from '@holo-js/panels-resources'
import CategoryResource from '../CategoryResource'

export default class EditCategory extends EditRecord {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return CategoryResource.actions(({ DeleteAction, ViewAction }) => [ViewAction.make(), DeleteAction.make()])
  }
}

