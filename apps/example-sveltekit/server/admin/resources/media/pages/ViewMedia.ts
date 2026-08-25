import { ViewRecord } from '@holo-js/panels-resources'
import { EditAction } from '@holo-js/panels-actions'
import MediaResource from '../MediaResource'

export default class ViewMedia extends ViewRecord {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

