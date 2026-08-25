import { Resource } from '@holo-js/panels'
import Comment from '../../../models/Comment'
import CreateComment from './pages/CreateComment'
import EditComment from './pages/EditComment'
import ListComments from './pages/ListComments'
import ViewComment from './pages/ViewComment'

export default class CommentResource extends Resource {
  protected static override model = Comment
  static override navigationGroup = 'Content'
  static override navigationIcon = 'chat'
  static override navigationLabel = 'Comments'
  static override navigationSort = 40
  static override recordTitleAttribute = this.attribute('authorName')
  static override routeKeyName = this.attribute('id')
  static override slug = 'comments'

  static form = this.configureForm((schema, field) => schema.components([
    field.TextInput.make('postId').required(),
    field.TextInput.make('authorName').required(),
    field.Textarea.make('body').required(),
    field.Select.make('status').options({ approved: 'Approved', pending: 'Pending', spam: 'Spam' }).required(),
  ]))

  static table = this.configureTable((table, component) => table
    .columns([
      component.TextColumn.make('authorName').searchable(),
      component.TextColumn.make('body').limit(80).wrap(),
      component.TextColumn.make('status').badge(),
    ])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))

  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListComments.route('/'),
      create: CreateComment.route('/create'),
      view: ViewComment.route('/{record}'),
      edit: EditComment.route('/{record}/edit'),
    }
  }
}
