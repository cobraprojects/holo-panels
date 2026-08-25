import { Resource } from '@holo-js/panels'
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

  static form = this.configureForm((schema, field) => schema.components([field.TextInput.make('postId').required(), field.TextInput.make('tagId').required()]))
  static table = this.configureTable((table, component) => table
    .columns([component.TextColumn.make('postId'), component.TextColumn.make('tagId')])
    .recordActions([component.ViewAction.make(), component.EditAction.make(), component.DeleteAction.make()])
    .toolbarActions([component.ActionGroup.make([component.DeleteBulkAction.make()])]))
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
