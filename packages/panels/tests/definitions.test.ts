import { belongsTo, column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import { Action, ActionGroup, CreateAction, DeleteAction, DeleteBulkAction, EditAction, ViewAction } from '@holo-js/panels-actions'
import { Checkbox, TextInput } from '@holo-js/panels-forms'
import { TextEntry } from '@holo-js/panels-infolists'
import { CreateRecord, EditRecord, ListRecords, RelationManager, Resource, ViewRecord } from '@holo-js/panels-resources'
import { SelectFilter, TextColumn } from '@holo-js/panels-tables'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  configureNotificationSender,
  defineColumn,
  defineCustomPage,
  defineField,
  definePanel,
  generatedResourcePageManifests,
  Notification,
  type ResourceRecordFor,
  type PanelDefinition,
} from '../src/index'

const authors = defineGeneratedTable('authors', {
  id: databaseColumn.id(),
  name: databaseColumn.string(),
})
const Author = defineModel(authors, { fillable: ['name'] })
const posts = defineGeneratedTable('posts', {
  authorId: databaseColumn.integer(),
  id: databaseColumn.id(),
  published: databaseColumn.boolean(),
  title: databaseColumn.string(),
})
const Post = defineModel(posts, {
  fillable: ['authorId', 'published', 'title'],
  relations: { author: belongsTo(() => Author, 'authorId') },
})
type PostRecord = ResourceRecordFor<typeof Post>
type AuthorRecord = ResourceRecordFor<typeof Author>

declare module '@holo-js/panels-core' {
  interface PanelRecordTypeRegistry {
    readonly author: AuthorRecord
    readonly post: PostRecord
  }
}

function typecheckOnly(): boolean { return false }

class ListPosts extends ListRecords {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [CreateAction.make().label('New post')]
  }
}

class CreatePost extends CreateRecord {
  static override get resource() { return PostResource }
}

class EditPost extends EditRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [ViewAction.make(), DeleteAction.make().requiresConfirmation()]
  }
}

class ViewPost extends ViewRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return [EditAction.make()]
  }
}

class PostResource extends Resource {
  protected static override model = Post
  static override recordTitleAttribute = this.attribute('title')

  static form = this.configureForm(schema => schema.components([
    TextInput.make('title')
      .required()
      .maxLength(120)
      .disabled(({ get, record, set }) => {
        expectTypeOf(record).toEqualTypeOf<PostRecord | null>()
        expectTypeOf(get('published')).toEqualTypeOf<boolean | undefined>()
        set('published', true)
        return false
      }),
    Checkbox.make('published'),
  ]))

  static infolist = this.configureInfolist(schema => schema.components([
    TextEntry.make('title'),
    TextEntry.make('author.name'),
  ]))

  static table = this.configureTable(table => table
    .columns([
      TextColumn.make('title').searchable().sortable(),
      TextColumn.make('author.name'),
    ])
    .filters([
      SelectFilter.make('title'),
      SelectFilter.make('author').relationship('author', 'name'),
    ])
    .recordActions([
      ViewAction.make(),
      EditAction.make(),
      DeleteAction.make(),
    ])
    .toolbarActions([
      ActionGroup.make([
        DeleteBulkAction.make(),
      ]),
    ])
  )

  static publishAction = this.action(Action.make('publish'))
    .authorize(({ record }) => {
      expectTypeOf(record).toEqualTypeOf<PostRecord | null>()
      return record !== null
    })
    .schema([
      TextInput.make('title'),
    ])
    .action((_data, { record, selectedRecords }) => {
      expectTypeOf(record).toEqualTypeOf<PostRecord | null>()
      expectTypeOf(selectedRecords).toEqualTypeOf<readonly PostRecord[]>()
      return record?.title
    })

  static invalidForm = typecheckOnly()
    ? this.configureForm(schema => {
        // @ts-expect-error name is not a Post field
        return schema.components([TextInput.make('name')])
      })
    : undefined

  static invalidTable = typecheckOnly()
    ? this.configureTable((table) => {
        // @ts-expect-error name is not a Post table path
        return table.columns([TextColumn.make('name')])
      })
    : undefined

  static invalidComponents = typecheckOnly()
    ? [
        // @ts-expect-error missing is not a generated model field
        TextInput.make('missing'),
        // @ts-expect-error title is not a generated boolean field
        Checkbox.make('title'),
        // @ts-expect-error author.missing is not a generated relation path
        TextColumn.make('author.missing'),
      ]
    : undefined

  static getPages() {
    return {
      index: ListPosts.route('/'),
      create: CreatePost.route('/create'),
      view: ViewPost.route('/{record}'),
      edit: EditPost.route('/{record}/edit'),
    }
  }
}

class SharedPostResource extends Resource {
  protected static override model = Post
  protected static override isScopedToTenant = false
}

declare module '@holo-js/panels-resources' {
  interface ResourceTypeRegistry {
    readonly post: { readonly model: typeof Post, readonly resource: typeof PostResource }
  }
}

class AuthorRelationManager extends RelationManager {
  protected static override relationship = 'author'

  static form = this.configureForm(schema => schema.components([
    TextInput.make('name'),
  ]))

  static table = this.configureTable(table => table
    .columns([TextColumn.make('name')])
    .recordActions([EditAction.make(), DeleteAction.make()])
  )
}

declare module '@holo-js/panels-resources' {
  interface RelationManagerTypeRegistry {
    readonly author: {
      readonly manager: typeof AuthorRelationManager
      readonly ownerModel: typeof Post
      readonly relationship: 'author'
    }
  }
}

describe('Filament 5-shaped public API', () => {
  it('opts shared resources out of tenant scoping through the resource property', () => {
    expect(SharedPostResource.compile().shared).toBe(true)
  })

  it('compiles resource pages and explicit page and table actions', () => {
    const pages = generatedResourcePageManifests({ panelPath: '/admin', resource: PostResource })
    const listResource = pages[0]?.body?.properties.resource
    const editResource = pages[3]?.body?.properties.resource

    expect(pages.map(page => [page.pageType, page.path, page.actions.header])).toEqual([
      ['list', '/admin/posts', ['create']],
      ['create', '/admin/posts/create', []],
      ['view', '/admin/posts/:record', ['edit']],
      ['edit', '/admin/posts/:record/edit', ['view', 'delete']],
    ])
    expect(listResource && typeof listResource === 'object' && !Array.isArray(listResource) ? listResource.table : null).toMatchObject({
      actions: [
        expect.objectContaining({ icon: 'view', id: 'view', scope: 'row' }),
        expect.objectContaining({ icon: 'edit', id: 'edit', scope: 'row' }),
        expect.objectContaining({ color: 'danger', confirmation: expect.any(String), icon: 'delete', id: 'delete', scope: 'row' }),
        expect.objectContaining({ actions: [expect.objectContaining({ color: 'danger', confirmation: expect.any(String), icon: 'delete', id: 'delete', scope: 'bulk' })], id: 'delete', scope: 'bulk' }),
      ],
    })
    expect(editResource && typeof editResource === 'object' && !Array.isArray(editResource) ? editResource.actions : null).toEqual([
      expect.objectContaining({ icon: 'view', id: 'view', kind: 'view' }),
      expect.objectContaining({ color: 'danger', confirmation: 'Are you sure?', icon: 'delete', id: 'delete', kind: 'delete' }),
    ])
  })

  it('uses one inferred action type in tables, pages, modal schemas, and notifications', async () => {
    const action = PostResource.publishAction

    const sent: object[] = []
    configureNotificationSender({ send: notification => { sent.push(notification) } })
    await Notification.make('published')
      .title('Published')
      .success()
      .actions([action])
      .send()

    expect(action.manifest('row')).toMatchObject({ id: 'publish', scope: 'row' })
    expect(sent).toEqual([expect.objectContaining({
      actions: [expect.objectContaining({ id: 'publish', scope: 'notification' })],
      id: 'published',
      status: 'success',
      title: 'Published',
    })])
    configureNotificationSender(null)
  })

  it('uses the normal schema, table, and action implementations in relation managers', () => {
    expect(AuthorRelationManager.compile()).toMatchObject({
      actions: [expect.objectContaining({ id: 'edit' }), expect.objectContaining({ id: 'delete' })],
      relationName: 'author',
      table: expect.any(Object),
    })
  })

  it('rejects invalid model fields and preserves fluent subtype methods', () => {
    expect(PostResource.invalidForm).toBeUndefined()
    expect(PostResource.invalidTable).toBeUndefined()
    expect(PostResource.compile()).toMatchObject({
      form: expect.any(Object),
      table: expect.any(Object),
    })
  })

  it('keeps panel and custom-component definitions independent from resource packages', () => {
    class RendererContext {
      readonly locale = 'en'
    }

    const panel = definePanel('admin')
      .default()
      .path('/admin')
      .guard('admin')
      .discoverResources()
      .discoverPages()
      .discoverWidgets()
      .discoverClusters()
    const page = defineCustomPage('overview').loader(context => {
      expectTypeOf(context.actor.name).toEqualTypeOf<string | undefined>()
      return { loaded: true }
    })
    const customField = defineField('rating', Number, RendererContext)
      .label('Rating')
      .renderer('app:field:rating')
      .properties({ maximum: 5 })
      .visible((value, context) => value >= 0 && context.locale.length > 0)
      .compile()
    const customColumn = defineColumn('rating').label('Rating').renderer('app:column:rating').compile()

    expectTypeOf(panel).toEqualTypeOf<PanelDefinition>()
    expect(panel.compileDiscoveryDefinition()).toMatchObject({ id: 'admin', kind: 'panel', route: '/admin' })
    expect(page.compileDiscoveryDefinition().id).toBe('overview')
    expect(customField).toMatchObject({ definitionKind: 'field', id: 'rating', properties: { maximum: 5 } })
    expect(customColumn.label).toBe('Rating')
  })
})
