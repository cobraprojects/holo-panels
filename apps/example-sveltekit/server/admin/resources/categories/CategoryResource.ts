import { Resource } from '@holo-js/panels'
import Category from '../../../models/Category'

export default class CategoryResource extends Resource {
  protected static override model = Category
  static override navigationGroup = 'Content'
  static override navigationIcon = 'folder'
  static override navigationLabel = 'Categories'
  static override navigationSort = 20
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'categories'

  static form = this.configureForm(schema => schema.components(field => [field.textInput('name').required(), field.textInput('slug').required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('name'), column.text('slug')]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'slug']) }
  static override getGlobalSearchResultsLimit() { return 10 }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
