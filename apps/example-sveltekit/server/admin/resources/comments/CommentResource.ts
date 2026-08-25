import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { Select, Textarea, TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
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

  static form = this.configureForm(schema => schema.components([
    TextInput.make('postId').required(),
    TextInput.make('authorName').required(),
    Textarea.make('body').required(),
    Select.make('status').options({ approved: 'Approved', pending: 'Pending', spam: 'Spam' }).required(),
  ]))

  static table = this.configureTable(table => table
    .columns([
      TextColumn.make('authorName').searchable(),
      TextColumn.make('body').limit(80).wrap(),
      TextColumn.make('status').badge(),
    ])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))

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
