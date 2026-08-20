import { Resource } from '@holo-js/panels'
import Membership from '../../../models/Membership'

export default class MembershipResource extends Resource {
  protected static override model = Membership
  static override navigationGroup = 'Access'
  static override navigationIcon = 'key'
  static override navigationLabel = 'Memberships'
  static override navigationSort = 60
  static override recordTitleAttribute = this.attribute('userId')
  static override routeKeyName = this.attribute('id')
  static override slug = 'memberships'

  static form = this.configureForm(schema => schema.components(field => [field.textInput('userId').required(), field.textInput('roleKey').required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('userId'), column.text('roleKey').badge()]))
  static override getGloballySearchableAttributes() { return this.attributes(['userId', 'roleKey']) }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
