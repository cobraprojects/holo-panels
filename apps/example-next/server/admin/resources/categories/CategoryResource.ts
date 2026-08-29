import { Resource } from '@holo-js/panels'
import Category from '../../../models/Category'
import ManageCategories from './pages/ManageCategories'

export default class CategoryResource extends Resource {
  protected static override model = Category
  static override navigationGroup = 'Content'
  static override navigationIcon = 'folder'
  static override navigationLabel = 'Categories'
  static override navigationSort = 20
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'categories'

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('name').required(), field.TextInput.make('slug').required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('name'), component.TextColumn.make('slug')])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'slug']) }
  static override getGlobalSearchResultsLimit() { return 10 }
  static getCreateBindings = this.configureCreateBindings(context => ({ id: `category-${crypto.randomUUID()}`, tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ManageCategories.route('/'),
    }
  }
}
