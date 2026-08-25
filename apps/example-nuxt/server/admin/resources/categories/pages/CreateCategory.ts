import { CreateRecord } from '@holo-js/panels-resources'
import CategoryResource from '../CategoryResource'

export default class CreateCategory extends CreateRecord {
  static override get resource() { return CategoryResource }
}

