import { ViewRecord } from '@holo-js/panels-resources'
import MediaResource from '../MediaResource'

export default class ViewMedia extends ViewRecord {
  static override get resource() { return MediaResource }

  protected override getHeaderActions() {
    return MediaResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

