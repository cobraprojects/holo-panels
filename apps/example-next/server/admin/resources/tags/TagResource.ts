import { Resource } from '@holo-js/panels'
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

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('name').required(), field.TextInput.make('slug').required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('name').searchable(), component.TextColumn.make('slug')])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
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
