import { Resource } from '@holo-js/panels'
import Tag from '../../../models/Tag'

export default class TagResource extends Resource {
  protected static override model = Tag
  static override navigationGroup = 'Content'
  static override navigationIcon = 'tag'
  static override navigationLabel = 'Tags'
  static override navigationSort = 30
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'tags'

  static form = this.configureForm(schema => schema.components(field => [field.textInput('name').required(), field.textInput('slug').required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('name').searchable(), column.text('slug')]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'slug']) }
  static override getGlobalSearchResultsLimit() { return 10 }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
