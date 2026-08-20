import { Resource } from '@holo-js/panels'
import PostTag from '../../../models/PostTag'

export default class PostTagResource extends Resource {
  protected static override model = PostTag
  static override navigationGroup = 'Content'
  static override navigationIcon = 'link'
  static override navigationLabel = 'Post tags'
  static override navigationSort = 35
  static override recordTitleAttribute = this.attribute('id')
  static override routeKeyName = this.attribute('id')
  static override slug = 'post-tags'

  static form = this.configureForm(schema => schema.components(field => [field.textInput('postId').required(), field.textInput('tagId').required()]))
  static table = this.configureTable(table => table.columns(column => [column.text('postId'), column.text('tagId')]))
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
