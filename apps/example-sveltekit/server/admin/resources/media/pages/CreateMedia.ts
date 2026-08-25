import { CreateRecord } from '@holo-js/panels-resources'
import MediaResource from '../MediaResource'

export default class CreateMedia extends CreateRecord {
  static override get resource() { return MediaResource }
}

