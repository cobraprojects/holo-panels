import { belongsTo, column as databaseColumn, defineGeneratedTable, defineModel } from '@holo-js/db'
import { CreateRecord, EditRecord, ListRecords, RelationManager, Resource, ViewRecord } from '@holo-js/panels-resources'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  configureNotificationSender,
  Action,
  defineColumn,
  defineCustomPage,
  defineField,
  definePanel,
  defineCustomWidget,
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

it('registers page widgets without displaying them on unrelated resource pages', () => {
  const footer = defineCustomWidget('record-context').data(() => ({ component: 'app.widgets.context', properties: {} }))
  class WidgetView extends ViewRecord {
    protected override getFooterWidgets() { return [footer] }
  }
  class WidgetList extends ListRecords {}
  class WidgetResource extends Resource {
    protected static override model = Author
    static getPages() { return { index: WidgetList.route('/'), view: WidgetView.route('/{record}') } }
  }
  const pages = generatedResourcePageManifests({ panelPath: '/admin', resource: WidgetResource })
  expect(pages.find(page => page.pageType === 'list')?.widgets).toEqual({ header: [], footer: [] })
  expect(pages.find(page => page.pageType === 'view')?.widgets).toEqual({ header: [], footer: ['record-context'] })
  expect(WidgetResource.compile().widgets).toHaveLength(1)
})
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

class NestedResource extends Resource {
  protected static override model = Post
  static form = this.configureForm((schema, { Grid, Section, Select, TextInput }) => schema.columns({ default: 1, lg: 2 }).components([
    Section.make('Details').schema([
      Grid.make({ default: 1, md: 2 }).schema([
        TextInput.make('title').required(),
        Select.make('authorId').options([{ value: 1, label: 'Author' }]),
      ]),
    ]),
  ]))
}

class CompleteFormResource extends Resource {
  protected static override model = Post
  static form = this.configureForm((schema, { Callout, EmptyState, Fieldset, Flex, Section, TextInput }) => schema.components([
    Flex.make([
      Section.make('Main').grow().columns({ default: 1, md: 2 }).schema([
        TextInput.make('title').prefix('@').prefixAction(Action.make<PostRecord>('copy-title').label('Copy title')).hint('Public title').dehydrateStateUsing(state => state?.trim() ?? ''),
      ]),
      Fieldset.make('Status').contained(false).grow(false).schema([]),
    ]).from('md').columnOrder({ default: 2, lg: 1 }),
    Callout.make('Check this').description('Before publishing').icon('info').color('warning'),
    EmptyState.make('Nothing here').description('Add a record').icon('plus'),
  ]))
}

class DependentResource extends Resource {
  protected static override model = Post
  static override isScopedToTenant = false
  static form = this.configureForm((schema, { Grid, TextInput }) => schema.components([
    Grid.make().schema(({ get, set }) => {
      expectTypeOf(get('published')).toEqualTypeOf<boolean | undefined>()
      set('title', 'Draft')
      return get('published') ? [TextInput.make('title')] : []
    }),
  ]))
}

declare module '@holo-js/panels-core' {
  interface PanelRecordTypeRegistry {
    readonly author: AuthorRecord
    readonly post: PostRecord
  }
}

function typecheckOnly(): boolean { return false }

it('keeps nested fields and their server option sources inside the generated form layout', () => {
  const compiled = NestedResource.compile()
  expect(compiled.form).toMatchObject({ fields: [{ kind: 'section', server: { children: [{ kind: 'grid' }] } }] })
  const manifest = generatedResourcePageManifests({ panelPath: '/admin', resource: NestedResource })
    .find(page => page.pageType === 'create')

  expect(manifest?.body?.properties).toMatchObject({ resource: { form: {
    fields: [{ path: 'title', required: true }, { path: 'authorId', properties: { options: [{ value: 1, label: 'Author' }] } }],
    schema: { components: [{ kind: 'grid', layout: { columns: { default: 1, lg: 2 } }, children: [{ kind: 'section', properties: { heading: 'Details' }, children: [{ kind: 'grid', children: [{ kind: 'field', statePath: 'title' }, { kind: 'field', statePath: 'authorId' }] }] }] }] },
  } } })
  expect(JSON.stringify(manifest)).not.toContain('server')
  expect(compiled.form).toBeDefined()
})

it('compiles the approved responsive layouts, field actions, and dehydration callbacks', async () => {
  const compiled = CompleteFormResource.compile()
  const form = compiled.form as { readonly fields: readonly object[] }
  const title = resourceField(form.fields, 'title')

  expect(title).toMatchObject({ properties: { prefixAction: { id: 'copy-title', label: 'Copy title' } }, server: { dehydrateStateUsing: expect.any(Function) } })
  expect(await Reflect.apply(Reflect.get(Reflect.get(title, 'server'), 'dehydrateStateUsing'), null, ['  Trimmed  ', {}])).toBe('Trimmed')
  expect(form.fields).toMatchObject([
    { kind: 'flex', from: 'md', columnOrder: { default: 2, lg: 1 } },
    { kind: 'callout', heading: 'Check this' },
    { kind: 'empty-state', heading: 'Nothing here' },
  ])
  expect(compiled.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'copy-title', mount: 'page', source: 'form-field:title' }),
    expect.objectContaining({ id: 'copy-title', mount: 'record', source: 'form-field:title' }),
  ]))
})

it('keeps dependent schema callbacks server-only with inferred get and set utilities', async () => {
  const form = DependentResource.compile().form as { readonly fields: readonly object[] }
  const grid = form.fields[0]
  if (!grid) throw new Error('Expected a grid component')
  const resolver = Reflect.get(Reflect.get(grid, 'server'), 'resolveChildren')
  const values = { published: true, title: '' }
  const children = await Reflect.apply(resolver, grid, [{
    get: (path: keyof typeof values) => values[path],
    operation: 'create',
    record: null,
    set: (path: keyof typeof values, value: boolean | string) => { Object.assign(values, { [path]: value }) },
  }])

  expect(children).toMatchObject([{ path: 'title', type: 'text' }])
  expect(values.title).toBe('Draft')
  expect(JSON.stringify(generatedResourcePageManifests({ panelPath: '/admin', resource: DependentResource }))).not.toContain('resolveChildren')
})

function resourceField(components: readonly object[], path: string): object {
  for (const component of components) {
    if (Reflect.get(component, 'path') === path) return component
    const children = Reflect.get(Reflect.get(component, 'server') ?? {}, 'children')
    if (Array.isArray(children)) {
      const match = resourceField(children, path)
      if (match) return match
    }
  }
  throw new Error(`Missing field ${path}`)
}

it('serializes action select options without serializing server option sources', () => {
  const action = PostResource.action(({ Action, Select }) => Action.make('choose').schema([Select.make('title').options({ draft: 'Draft' })]))
  const manifest = action.manifest()
  expect(manifest.modal).toMatchObject({ schema: { fields: [{ path: 'title', properties: { options: { draft: 'Draft' } } }] } })
  expect(JSON.stringify(manifest)).not.toContain('server')
})

it('registers table actions at their declared header, row, and bulk mounts', () => {
  class MountedResource extends Resource {
    protected static override model = Post
    static table = this.configureTable((table, { Action }) => table
      .headerActions([Action.make('header')])
      .emptyStateActions([Action.make('empty')])
      .recordActions([Action.make('row')])
      .toolbarActions([Action.make('bulk')]))
  }
  expect(MountedResource.compile().actions).toEqual([
    expect.objectContaining({ id: 'row', mount: 'record', source: 'table' }),
    expect.objectContaining({ id: 'header', mount: 'page', source: 'table' }),
    expect.objectContaining({ id: 'empty', mount: 'page', source: 'table' }),
    expect.objectContaining({ id: 'bulk', mount: 'bulk', source: 'table' }),
  ])
})

it('registers customized form actions and removes the execution path when a getter returns null', () => {
  class CustomEdit extends EditRecord<PostRecord> {
    protected override getSaveFormAction() { return PostResource.action(({ EditAction }) => EditAction.make().label('Save draft').requiresConfirmation(false)) }
  }
  class RemovedEdit extends EditRecord<PostRecord> {
    protected override getSaveFormAction() { return null }
  }
  class CustomResource extends Resource {
    protected static override model = Post
    protected static getPages() { return { edit: CustomEdit.route('/{record}/edit') } }
  }
  class RemovedResource extends CustomResource {
    protected static override getPages() { return { edit: RemovedEdit.route('/{record}/edit') } }
  }
  expect(CustomResource.compile().actions).toEqual([expect.objectContaining({ confirmation: null, id: 'edit', label: 'Save draft', mount: 'record', source: 'edit:form' })])
  expect(RemovedResource.compile().actions).toEqual([])
})

class ListPosts extends ListRecords {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ CreateAction }) => [
      CreateAction.make()
        .label('New post')
        .visible(({ record }) => {
          expectTypeOf(record).toEqualTypeOf<PostRecord | null>()
          return true
        }),
      PostResource.publishAction,
    ])
  }
}

class CreatePost extends CreateRecord {
  static override get resource() { return PostResource }
}

class EditPost extends EditRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ DeleteAction, ViewAction }) => [
      ViewAction.make(),
      DeleteAction.make().requiresConfirmation(),
    ])
  }
}

class ViewPost extends ViewRecord {
  static override get resource() { return PostResource }

  protected override getHeaderActions() {
    return PostResource.actions(({ EditAction }) => [EditAction.make()])
  }
}

class PostResource extends Resource {
  protected static override model = Post
  static override recordTitleAttribute = this.attribute('title')

  static form = this.configureForm((schema, { Checkbox, TextInput }) => schema.components([
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

  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([
    TextEntry.make('title'),
    TextEntry.make('author.name'),
  ]))

  static table = this.configureTable((table, { ActionGroup, DeleteAction, DeleteBulkAction, EditAction, SelectFilter, TextColumn, ViewAction }) => table
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

  static publishAction = this.action(({ Action, TextInput }) => Action.make('publish')
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
    }))

  static invalidForm = typecheckOnly()
    ? this.configureForm((schema, { TextInput }) => {
        // @ts-expect-error name is not a Post field
        return schema.components([TextInput.make('name')])
      })
    : undefined

  static invalidTable = typecheckOnly()
    ? this.configureTable((table, { TextColumn }) => {
        // @ts-expect-error name is not a Post table path
        return table.columns([TextColumn.make('name')])
      })
    : undefined

  static invalidComponents = typecheckOnly()
    ? this.configureForm((schema, { Checkbox, TextInput }) => schema.components([
        // @ts-expect-error missing is not a generated model field
        TextInput.make('missing'),
        // @ts-expect-error title is not a generated boolean field
        Checkbox.make('title'),
      ]))
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
    readonly completeForm: { readonly model: typeof Post, readonly resource: typeof CompleteFormResource }
    readonly dependent: { readonly model: typeof Post, readonly resource: typeof DependentResource }
    readonly nested: { readonly model: typeof Post, readonly resource: typeof NestedResource }
    readonly post: { readonly model: typeof Post, readonly resource: typeof PostResource }
  }
}

class AuthorRelationManager extends RelationManager {
  protected static override relationship = 'author'

  static form = this.configureForm((schema, { TextInput }) => schema.components([
    TextInput.make('name'),
  ]))

  static infolist = this.configureInfolist((schema, { TextEntry }) => schema.components([
    TextEntry.make('name'),
  ]))

  static table = this.configureTable((table, { DeleteAction, EditAction, TextColumn }) => table
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
      ['list', '/admin/posts', ['create', 'publish']],
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
    expect(PostResource.compile().actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'publish', mount: 'page' }),
    ]))
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
      actions: [expect.objectContaining({ execution: { actionId: 'publish', resourceId: 'posts' }, id: 'publish', scope: 'notification' })],
      id: 'published',
      status: 'success',
      title: 'Published',
    })])
    configureNotificationSender(null)
  })

  it('uses the normal schema, table, and action implementations in relation managers', () => {
    const relationManager = AuthorRelationManager.compile()
    const infolist = Reflect.get(relationManager, 'infolist')

    expect(relationManager).toMatchObject({
      actions: [expect.objectContaining({ id: 'edit' }), expect.objectContaining({ id: 'delete' })],
      infolist: expect.any(Object),
      relationName: 'author',
      table: expect.any(Object),
    })
    expect(Reflect.apply(Reflect.get(infolist, 'compile'), infolist, [])).toMatchObject({
      fields: [expect.objectContaining({ path: 'name', type: 'text' })],
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
