import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
import Membership from '../../../models/Membership'
import CreateMembership from './pages/CreateMembership'
import EditMembership from './pages/EditMembership'
import ListMemberships from './pages/ListMemberships'
import ViewMembership from './pages/ViewMembership'

export default class MembershipResource extends Resource {
  protected static override model = Membership
  static override navigationGroup = 'Access'
  static override navigationIcon = 'key'
  static override navigationLabel = 'Memberships'
  static override navigationSort = 60
  static override recordTitleAttribute = this.attribute('userId')
  static override routeKeyName = this.attribute('id')
  static override slug = 'memberships'

  static form = this.configureForm(schema => schema.components([TextInput.make('userId').required(), TextInput.make('roleKey').required()]))
  static table = this.configureTable(table => table
    .columns([TextColumn.make('userId'), TextColumn.make('roleKey').badge()])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))
  static override getGloballySearchableAttributes() { return this.attributes(['userId', 'roleKey']) }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListMemberships.route('/'),
      create: CreateMembership.route('/create'),
      view: ViewMembership.route('/{record}'),
      edit: EditMembership.route('/{record}/edit'),
    }
  }
}
