import { Resource } from '@holo-js/panels'
import Media from '../../../models/Media'
import CreateMedia from './pages/CreateMedia'
import EditMedia from './pages/EditMedia'
import ListMedia from './pages/ListMedia'
import ViewMedia from './pages/ViewMedia'

export default class MediaResource extends Resource {
  protected static override model = Media
  static override navigationGroup = 'Content'
  static override navigationIcon = 'image'
  static override navigationLabel = 'Media'
  static override navigationSort = 50
  static override recordTitleAttribute = this.attribute('alt')
  static override routeKeyName = this.attribute('id')
  static override slug = 'media'
  static override writableAttributes = this.attributes(['alt'])

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('alt').required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('alt').searchable(), component.TextColumn.make('mime').badge(), component.TextColumn.make('size').number()])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListMedia.route('/'),
      create: CreateMedia.route('/create'),
      view: ViewMedia.route('/{record}'),
      edit: EditMedia.route('/{record}/edit'),
    }
  }
}
