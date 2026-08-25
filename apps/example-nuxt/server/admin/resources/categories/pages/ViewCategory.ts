import { ViewRecord } from '@holo-js/panels-resources'
import CategoryResource from '../CategoryResource'

export default class ViewCategory extends ViewRecord {
  static override get resource() { return CategoryResource }

  protected override getHeaderActions() {
    return CategoryResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

