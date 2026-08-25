import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
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

  static form = this.configureForm(schema => schema.components([TextInput.make('name').required(), TextInput.make('email').email().required()]))
  static table = this.configureTable(table => table
    .columns([TextColumn.make('name').searchable(), TextColumn.make('email').copyable()])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))
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
