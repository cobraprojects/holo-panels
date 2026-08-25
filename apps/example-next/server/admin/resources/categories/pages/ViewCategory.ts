import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import CategoryResource from '../CategoryResource'

export default class ViewCategory extends ViewRecord {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

