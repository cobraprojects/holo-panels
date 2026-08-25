import { EditRecord } from '@holo-js/panels-resources'
import { DeleteAction, ViewAction } from '@holo-js/panels-actions'
import CategoryResource from '../CategoryResource'

export default class EditCategory extends EditRecord {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make()]
  }
}

