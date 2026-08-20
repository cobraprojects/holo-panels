import { Resource } from '@holo-js/panels'
import User from '../../../models/User'

export default class UserResource extends Resource {
  protected static override model = User
  static override navigationGroup = 'Access'
  static override navigationIcon = 'users'
  static override navigationLabel = 'Users'
  static override navigationSort = 70
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'users'

  static form = this.configureForm(schema => schema.components(field => [field.textInput('name').required(), field.textInput('email').email().required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('name').searchable(), column.text('email').copyable()]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'email']) }
}
