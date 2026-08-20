import { Resource } from '@holo-js/panels'
import Comment from '../../../models/Comment'

export default class CommentResource extends Resource {
  protected static override model = Comment
  static override navigationGroup = 'Content'
  static override navigationIcon = 'chat'
  static override navigationLabel = 'Comments'
  static override navigationSort = 40
  static override recordTitleAttribute = this.attribute('authorName')
  static override routeKeyName = this.attribute('id')
  static override slug = 'comments'

  static form = this.configureForm(schema => schema.components(field => [
    field.textInput('postId').required(),
    field.textInput('authorName').required(),
    field.textarea('body').required(),
    field.select('status').options({ approved: 'Approved', pending: 'Pending', spam: 'Spam' }).required(),
  ]))

  static table = this.configureTable(table => table.columns(column => [
    column.text('authorName').searchable(),
    column.text('body').limit(80).wrap(),
    column.text('status').badge(),
  ]))

  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))
}
