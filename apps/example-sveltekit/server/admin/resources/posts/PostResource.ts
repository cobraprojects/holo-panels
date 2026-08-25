import {
  Resource,
  defineResourceStatsWidget,
} from '@holo-js/panels'
import {
  BulkAction,
  BulkActionGroup,
  DeleteAction,
  DeleteBulkAction,
  EditAction,
} from '@holo-js/panels-actions'
import { FileUpload, Radio, Select, TextInput } from '@holo-js/panels-forms'
import { TextEntry } from '@holo-js/panels-infolists'
import { SelectFilter, TextColumn } from '@holo-js/panels-tables'
import Post from '../../../models/Post'
import CreatePost from './pages/CreatePost'
import EditPost from './pages/EditPost'
import ListPosts from './pages/ListPosts'
import ViewPost from './pages/ViewPost'
import CommentsRelationManager from './relation-managers/CommentsRelationManager'
import TagsRelationManager from './relation-managers/TagsRelationManager'

const activeQuery = defineResourceStatsWidget('active-query', { record: Post })
  .heading('Active query')
  .columnSpan('full')
  .data(context => ({
    stats: [{
      action: null,
      chart: [],
      color: 'primary',
      description: `Search: ${context.resource?.tableState?.search ?? ''}`,
      icon: 'search',
      id: 'search',
      label: 'Search',
      trend: null,
      url: null,
      value: context.resource?.tableState?.search || 'All records',
    }],
  }))

export default class PostResource extends Resource {
  protected static override model = Post
  static override navigationIcon = 'document'
  static override navigationLabel = 'Posts'
  static override navigationSort = 10
  static override recordTitleAttribute = this.attribute('title')
  static override routeKeyName = this.attribute('id')
  static override slug = 'posts'

  static publishSelected = this.action(BulkAction.make('publish-selected'))
    .label('Publish selected')
    .icon('check')
    .requiresConfirmation('Publish the selected posts?')
    .authorize(() => true)
    .action(async (_data, { selectedRecords }) => {
      for (const selectedRecord of selectedRecords) {
        const post = await Post.where('id', selectedRecord.id).first()
        if (!post) throw new Error('A selected post no longer exists.')
        await post.update({ status: 'published' })
      }
      return { published: selectedRecords.map(record => record.id) }
    })

  static form = this.configureForm(schema => schema.components([
    TextInput.make('title').required(),
    TextInput.make('slug').required(),
    Radio.make('category').options([
      { label: 'News', value: 'News' },
      { label: 'Guides', value: 'Guides' },
    ]).required(),
    Select.make('city').options([
      { label: 'Alexandria', value: 'Alexandria' },
      { label: 'Cairo', value: 'Cairo' },
      { label: 'Giza', value: 'Giza' },
    ]).required(),
    FileUpload.make('featuredMediaId')
      .image()
      .disk('private')
      .directory('panels/uploads/posts')
      .acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
      .maxSize(5_242_880),
  ]))

  static infolist = this.configureInfolist(schema => schema.components([
    TextEntry.make('title').label('Title'),
    TextEntry.make('slug').label('Slug').copyable(),
    TextEntry.make('category').label('Category').badge(),
    TextEntry.make('city').label('City'),
  ]))

  static table = this.configureTable(table => table
    .columns([
      TextColumn.make('title').searchable().sortable(),
      TextColumn.make('slug').copyable(),
      TextColumn.make('category').badge(),
      TextColumn.make('city'),
      TextColumn.make('author.name').label('Author'),
    ])
    .filters([
      SelectFilter.make('category').label('Category').options({ Guides: 'Guides', News: 'News' }),
      SelectFilter.make('city').label('City').options({ Alexandria: 'Alexandria', Cairo: 'Cairo', Giza: 'Giza' }),
    ])
    .deferFilters()
    .recordActions([
      EditAction.make(),
      DeleteAction.make(),
    ])
    .toolbarActions([
      BulkActionGroup.make([
        this.publishSelected,
        DeleteBulkAction.make(),
      ]),
    ])
  )

  static override getGloballySearchableAttributes() {
    return this.attributes(['title', 'slug'])
  }

  static override getGlobalSearchResultDetailAttributes() {
    return this.attributes(['category', 'city'])
  }

  static override getGlobalSearchResultsLimit() {
    return 10
  }

  static getCreateBindings = this.configureCreateBindings(context => {
    if (!context.actor) throw new Error('An authenticated actor is required to create a post.')
    return {
      authorId: String(context.actor.id),
      body: 'Created through Holo Panels.',
      categoryId: `category-${context.tenant.replace(/^tenant-/u, '')}-guides`,
      excerpt: 'Created through Holo Panels.',
      status: 'draft',
      tenantId: context.tenant,
    }
  })

  static scopeQueryToTenant = this.configureQuery((query, context) => {
    return query.where('tenantId', context.tenant)
  })

  static getRelations() {
    return [CommentsRelationManager, TagsRelationManager]
  }

  static override getWidgets() {
    return [activeQuery]
  }

  static getPages() {
    return {
      index: ListPosts.route('/'),
      create: CreatePost.route('/create'),
      view: ViewPost.route('/{record}'),
      edit: EditPost.route('/{record}/edit'),
    }
  }
}
