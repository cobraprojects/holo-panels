import { Resource, defineResourceStatsWidget } from '@holo-js/panels'
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

  static publishSelected = this.action(({ BulkAction }) => BulkAction.make('publish-selected')
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
    }))

  static form = this.configureForm((schema, field) => schema.components([
    field.TextInput.make('title').required(),
    field.TextInput.make('slug').required(),
    field.Radio.make('category').options([
      { label: 'News', value: 'News' },
      { label: 'Guides', value: 'Guides' },
    ]).required(),
    field.Select.make('city').options([
      { label: 'Alexandria', value: 'Alexandria' },
      { label: 'Cairo', value: 'Cairo' },
      { label: 'Giza', value: 'Giza' },
    ]).required(),
    field.FileUpload.make('featuredMediaId')
      .image()
      .disk('local')
      .directory('panels/uploads/posts')
      .acceptedFileTypes(['image/jpeg', 'image/png', 'image/webp'])
      .maxSize(5_242_880),
  ]))

  static infolist = this.configureInfolist((schema, entry) => schema.components([
    entry.TextEntry.make('title').label('Title'),
    entry.TextEntry.make('slug').label('Slug').copyable(),
    entry.TextEntry.make('category').label('Category').badge(),
    entry.TextEntry.make('city').label('City'),
  ]))

  static table = this.configureTable((table, component) => table
    .columns([
      component.TextColumn.make('title').searchable().sortable(),
      component.TextColumn.make('slug').copyable(),
      component.TextColumn.make('category').badge(),
      component.TextColumn.make('city'),
      component.TextColumn.make('author.name').label('Author'),
    ])
    .filters([
      component.SelectFilter.make('category').label('Category').options({ Guides: 'Guides', News: 'News' }),
      component.SelectFilter.make('city').label('City').options({ Alexandria: 'Alexandria', Cairo: 'Cairo', Giza: 'Giza' }),
    ])
    .deferFilters()
    .recordActions([
      component.ViewAction.make(),
      component.EditAction.make(),
      component.DeleteAction.make(),
    ])
    .toolbarActions([
      component.BulkActionGroup.make([
        this.publishSelected,
        component.DeleteBulkAction.make(),
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
