import { Resource } from '@holo-js/panels'
import Media from '../../../models/Media'

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

  static form = this.configureForm(schema => schema.components(field => [field.textInput('alt').required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('alt').searchable(), column.text('mime').badge(), column.text('size').number()]))
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
