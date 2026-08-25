import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
import Tag from '../../../models/Tag'
import CreateTag from './pages/CreateTag'
import EditTag from './pages/EditTag'
import ListTags from './pages/ListTags'
import ViewTag from './pages/ViewTag'

export default class TagResource extends Resource {
  protected static override model = Tag
  static override navigationGroup = 'Content'
  static override navigationIcon = 'tag'
  static override navigationLabel = 'Tags'
  static override navigationSort = 30
  static override recordTitleAttribute = this.attribute('name')
  static override routeKeyName = this.attribute('id')
  static override slug = 'tags'

  static form = this.configureForm(schema => schema.components([TextInput.make('name').required(), TextInput.make('slug').required()]))
  static table = this.configureTable(table => table
    .columns([TextColumn.make('name').searchable(), TextColumn.make('slug')])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))
  static override getGloballySearchableAttributes() { return this.attributes(['name', 'slug']) }
  static override getGlobalSearchResultsLimit() { return 10 }
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListTags.route('/'),
      create: CreateTag.route('/create'),
      view: ViewTag.route('/{record}'),
      edit: EditTag.route('/{record}/edit'),
    }
  }
}
