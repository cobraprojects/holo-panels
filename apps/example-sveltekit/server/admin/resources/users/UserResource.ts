import { Resource } from '@holo-js/panels'
import User from '../../../models/User'
import CreateUser from './pages/CreateUser'
import EditUser from './pages/EditUser'
import ListUsers from './pages/ListUsers'
import ViewUser from './pages/ViewUser'

export default class UserResource extends Resource {
  protected static override model = User
  protected static override isScopedToTenant = false
  static override navigationGroup = 'Access'
  static override navigationIcon = 'users'
  static override navigationLabel = 'Users'
  static override navigationSort = 70
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'users'

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('name').required(), field.TextInput.make('email').email().required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('name').searchable(), component.TextColumn.make('email').copyable()])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'email']) }

  static getPages() {
    return {
      index: ListUsers.route('/'),
      create: CreateUser.route('/create'),
      view: ViewUser.route('/{record}'),
      edit: EditUser.route('/{record}/edit'),
    }
  }
}
