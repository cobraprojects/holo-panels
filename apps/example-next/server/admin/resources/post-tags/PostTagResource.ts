import { Resource } from '@holo-js/panels'
import { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { TextInput } from '@holo-js/panels-forms'
import { TextColumn } from '@holo-js/panels-tables'
import PostTag from '../../../models/PostTag'
import CreatePostTag from './pages/CreatePostTag'
import EditPostTag from './pages/EditPostTag'
import ListPostTags from './pages/ListPostTags'
import ViewPostTag from './pages/ViewPostTag'

export default class PostTagResource extends Resource {
  protected static override model = PostTag
  static override navigationGroup = 'Content'
  static override navigationIcon = 'link'
  static override navigationLabel = 'Post tags'
  static override navigationSort = 35
  static override recordTitleAttribute = this.attribute('id')
  static override routeKeyName = this.attribute('id')
  static override slug = 'post-tags'

  static form = this.configureForm(schema => schema.components([TextInput.make('postId').required(), TextInput.make('tagId').required()]))
  static table = this.configureTable(table => table
    .columns([TextColumn.make('postId'), TextColumn.make('tagId')])
    .recordActions([ViewAction.make(), EditAction.make(), DeleteAction.make()])
    .toolbarActions([ActionGroup.make([DeleteBulkAction.make()])]))
  static getCreateBindings = this.configureCreateBindings(context => ({ tenantId: context.tenant }))
  static scopeQueryToTenant = this.configureQuery((query, context) => query.where('tenantId', context.tenant))

  static getPages() {
    return {
      index: ListPostTags.route('/'),
      create: CreatePostTag.route('/create'),
      view: ViewPostTag.route('/{record}'),
      edit: EditPostTag.route('/{record}/edit'),
    }
  }
}
