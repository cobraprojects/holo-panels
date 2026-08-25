import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
import Category from '../../../models/Category'
import CreateCategory from './pages/CreateCategory'
import EditCategory from './pages/EditCategory'
import ListCategories from './pages/ListCategories'
import ViewCategory from './pages/ViewCategory'

export default class CategoryResource extends Resource {
  protected static override model = Category
  static override navigationGroup = 'Content'
  static override navigationIcon = 'folder'
  static override navigationLabel = 'Categories'
  static override navigationSort = 20
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'categories'

  static form = this.configureForm(schema => schema.components([TextInput.make('name').required(), TextInput.make('slug').required()]))
  static table = this.configureTable(table => table
    .columns([TextColumn.make('name'), TextColumn.make('slug')])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'slug']) }
  static override getGlobalSearchResultsLimit() { return 10 }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListCategories.route('/'),
      create: CreateCategory.route('/create'),
      view: ViewCategory.route('/{record}'),
      edit: EditCategory.route('/{record}/edit'),
    }
  }
}
