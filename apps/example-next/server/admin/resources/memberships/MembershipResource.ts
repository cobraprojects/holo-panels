import { Resource } from '@holo-js/panels'
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

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('userId').required(), field.TextInput.make('roleKey').required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('userId'), component.TextColumn.make('roleKey').badge()])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
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
