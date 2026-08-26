import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { serializeManifest } from '../src/protocol/serialization'
import { entriesFor } from '../src/infolists/entries'
import { executeGeneratedGlobalSearch, executeGeneratedResourceOperation, generatedResourcePageManifests } from '../src/resources/generated-pages'
import {
  type BooleanColumn,
  type CheckboxColumn,
  type ColorColumn,
  type CustomColumn,
  type IconColumn,
  type ImageColumn,
  type PanelRelationValue,
  type SelectColumn,
  type TextColumn,
  type TextInputColumn,
  type ToggleColumn,
  columnsFor,
  executeInlineColumnEdit,
  formatTextValue,
  type RecordPath,
  type RecordPathFor,
  type RecordPathValue,
} from '../src/tables/columns'

class PostRecord {
  declare active: boolean
  declare author: PanelRelationValue<{
    email: string
    name: string
  }>
  declare comments: PanelRelationValue<readonly {
    body: string
    score: number
  }[]>
  declare cover: string
  declare id: number
  declare metadata: {
    color: string
  }
  declare status: 'draft' | 'published'
  declare title: string
  declare total: number
}

describe('P7-B column inference and built-ins', () => {
  it('includes titled resources in global search by default and honors panel opt-in mode', async () => {
    const record = { id: 'first', title: 'First post', toJSON: () => ({ id: 'first', title: 'First post' }) }
    interface SearchQueryStub {
      get(): Promise<readonly typeof record[]>
      limit(): SearchQueryStub
      orWhereLike(): SearchQueryStub
      orWhereRelation(): SearchQueryStub
      where(callback: ((value: SearchQueryStub) => SearchQueryStub) | string): SearchQueryStub
      whereLike(): SearchQueryStub
      whereRelation(): SearchQueryStub
      with(): SearchQueryStub
    }
    const query: SearchQueryStub = {
      get: async () => [record],
      limit: () => query,
      orWhereLike: () => query,
      orWhereRelation: () => query,
      where: (callback: ((value: typeof query) => typeof query) | string) => typeof callback === 'function' ? callback(query) : query,
      whereLike: () => query,
      whereRelation: () => query,
      with: () => query,
    }
    const resource = {
      baseQuery: (value: typeof query) => value,
      id: 'posts',
      kind: 'resource',
      model: { definition: { primaryKey: 'id' }, query: () => query },
      navigation: {},
      recordTitle: 'title',
      routeKey: 'id',
      shared: true,
      slug: 'posts',
    }
    const input = {
      actor: { id: 'admin' },
      panelId: 'admin',
      panelPath: '/admin',
      resources: [resource],
      signal: new AbortController().signal,
      tenant: null,
      term: 'First',
    }

    await expect(executeGeneratedGlobalSearch(input)).resolves.toMatchObject({ results: [{ id: 'first', title: 'First post' }] })
    await expect(executeGeneratedGlobalSearch({ ...input, resourceOptIn: true })).resolves.toMatchObject({ results: [] })
    await expect(executeGeneratedGlobalSearch({ ...input, strictAuthorization: true })).rejects.toThrow()
  })

  it('preserves precise record, relation, and value paths', () => {
    expectTypeOf<'author.name'>().toExtend<RecordPath<PostRecord>>()
    expectTypeOf<'comments.0.score'>().toExtend<RecordPath<PostRecord>>()
    expectTypeOf<RecordPathFor<PostRecord, boolean>>().toEqualTypeOf<'active'>()
    expectTypeOf<RecordPathValue<PostRecord, 'author.email'>>().toEqualTypeOf<string>()

    const column = columnsFor(PostRecord).text('author.name').label('Author').sortable()
    expectTypeOf(column).toEqualTypeOf<TextColumn<PostRecord, 'author.name'>>()
    expect(column.compile().manifest.path).toBe('author.name')
  })

  it('compiles every built-in and custom column type', () => {
    const factory = columnsFor(PostRecord)
    const icon = factory.icon('status')
    const boolean = factory.boolean('active')
    const image = factory.image('cover')
    const color = factory.color('metadata.color')
    const checkbox = factory.checkbox('active').editable('posts.checkbox')
    const select = factory.select('status').editable('posts.status', [
      { label: 'Draft', value: 'draft' },
      { label: 'Published', value: 'published' },
    ])
    const toggle = factory.toggle('active').editable('posts.toggle')
    const textInput = factory.textInput('title').editable('posts.title', { maximumLength: 200 })
    const custom = factory.custom('acme:column:score', 'total', { precision: 2 })
    const columns = [
      factory.text('title'),
      icon,
      boolean,
      image,
      color,
      checkbox,
      select,
      toggle,
      textInput,
      custom,
    ]

    expect(columns.map(column => column.compile().manifest.type)).toEqual([
      'text', 'icon', 'boolean', 'image', 'color', 'checkbox', 'select', 'toggle', 'text-input', 'acme:column:score',
    ])
    expect(columns.every(column => Object.isFrozen(column.compile()))).toBe(true)
    expectTypeOf(icon).toEqualTypeOf<IconColumn<PostRecord, 'status'>>()
    expectTypeOf(boolean).toEqualTypeOf<BooleanColumn<PostRecord, 'active'>>()
    expectTypeOf(image).toEqualTypeOf<ImageColumn<PostRecord, 'cover'>>()
    expectTypeOf(color).toEqualTypeOf<ColorColumn<PostRecord, 'metadata.color'>>()
    expectTypeOf(checkbox).toEqualTypeOf<CheckboxColumn<PostRecord, 'active'>>()
    expectTypeOf(select).toEqualTypeOf<SelectColumn<PostRecord, 'status'>>()
    expectTypeOf(toggle).toEqualTypeOf<ToggleColumn<PostRecord, 'active'>>()
    expectTypeOf(textInput).toEqualTypeOf<TextInputColumn<PostRecord, 'title'>>()
    expectTypeOf(custom).toEqualTypeOf<CustomColumn<PostRecord, 'total', 'acme:column:score'>>()
  })

  it('composes common state and relationship aggregate capabilities', () => {
    const definition = columnsFor(PostRecord).text('title')
      .label('Post')
      .searchable()
      .sortable()
      .toggleable(false)
      .hidden()
      .alignment('end')
      .width('18rem')
      .wrap(false)
      .lineClamp(2)
      .count('comments')
      .compile()

    expect(definition.manifest).toMatchObject({
      alignment: 'end',
      dataSource: { kind: 'count', relation: 'comments' },
      hidden: true,
      label: 'Post',
      lineClamp: 2,
      searchable: true,
      sortable: true,
      toggleable: false,
      width: '18rem',
      wrap: false,
    })

    expect(columnsFor(PostRecord).text('author.name').relationship('author', 'name').compile().manifest.dataSource)
      .toEqual({ kind: 'relationship', relation: 'author', titlePath: 'name' })
    expect(columnsFor(PostRecord).text('title').relationship('comments', 'body').compile().manifest.dataSource)
      .toEqual({ kind: 'relationship', relation: 'comments', titlePath: 'body' })
    expect(columnsFor(PostRecord).text('total').aggregate('comments', 'score', 'average').compile().manifest.dataSource)
      .toEqual({ aggregate: 'average', field: 'score', kind: 'aggregate', relation: 'comments' })
    expect(columnsFor(PostRecord).boolean('active').exists('comments').compile().manifest.dataSource)
      .toEqual({ kind: 'exists', relation: 'comments' })
  })
})

describe('P7-B text formatting and manifest security', () => {
  it('places resource widgets on the list page without leaking them into record forms', () => {
    const manifests = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        capabilities: { delete: true, forceDelete: false, restore: false },
        id: 'posts',
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
        widgets: [
          { compile: () => ({ kind: 'widget', manifest: { id: 'post-stats' } }) },
          { compile: () => ({ kind: 'widget', manifest: { id: 'post-stats' } }) },
          { compile: () => ({ kind: 'widget', manifest: { id: 'recent-comments' } }) },
        ],
      },
    })

    expect(manifests).toHaveLength(4)
    expect(manifests.find(manifest => manifest.pageType === 'list')?.widgets.header).toEqual(['post-stats', 'recent-comments'])
    expect(manifests.filter(manifest => manifest.pageType !== 'list').every(manifest => manifest.widgets.header.length === 0)).toBe(true)
  })

  it('reactively derives a conventional slug field from the title without extra resource configuration', () => {
    const create = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        capabilities: { delete: true, forceDelete: false, restore: false },
        form: {
          fields: [
            { path: 'title', properties: {}, type: 'text' },
            { path: 'slug', properties: {}, type: 'text' },
          ],
        },
        id: 'posts',
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
      },
    }).find(manifest => manifest.pageType === 'create')

    const resource = create?.body?.properties.resource
    const form = resource && typeof resource === 'object' && !Array.isArray(resource) ? resource.form : null

    expect(form).toMatchObject({
      dependencies: [{
        patches: [{ path: 'slug', resolver: { input: { source: 'title' }, name: 'slug' } }],
        paths: ['title'],
      }],
      fields: [
        expect.objectContaining({ path: 'title', type: 'text' }),
        expect.objectContaining({ path: 'slug', properties: expect.objectContaining({ source: 'title', specialization: 'slug' }), type: 'slug' }),
      ],
    })
  })

  it('preserves complete column presentation through generated resource pages', () => {
    const column = columnsFor(PostRecord).text('total')
      .money('USD')
      .badge()
      .lineClamp(2)
      .searchable()
      .sortable()
      .compile().manifest
    const manifests = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        capabilities: { delete: true, forceDelete: false, restore: false },
        form: { fields: [] },
        id: 'posts',
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
        table: { columns: [column] },
      },
    })
    const resource = manifests[0]?.body?.properties.resource
    const table = resource && typeof resource === 'object' && !Array.isArray(resource) ? resource.table : null
    const columns = table && typeof table === 'object' && !Array.isArray(table) && Array.isArray(table.columns) ? table.columns : []

    expect(columns[0]).toMatchObject({
      dataSource: { kind: 'path' },
      formatters: [{ currency: 'USD', kind: 'money' }, { kind: 'badge', value: true }],
      lineClamp: 2,
      path: 'total',
      searchable: true,
      sortable: true,
    })
  })

  it('publishes table filters in the renderer protocol shape', () => {
    const manifests = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        capabilities: { delete: true, forceDelete: false, restore: false },
        form: { fields: [] },
        id: 'posts',
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
        table: {
          columns: [],
          filters: [{ defaultValue: null, id: 'status', label: 'Status', multiple: true, options: { draft: 'Draft', published: 'Published' }, type: 'select' }],
        },
      },
    })
    const resource = manifests[0]?.body?.properties.resource
    const table = resource && typeof resource === 'object' && !Array.isArray(resource) && resource.table && typeof resource.table === 'object' && !Array.isArray(resource.table)
      ? resource.table
      : null

    expect(table?.filters).toEqual([{
      defaultValue: null,
      id: 'status',
      label: 'Status',
      layout: {},
      mode: 'live',
      properties: {
        multiple: true,
        options: [
          { disabled: false, label: 'Draft', value: 'draft' },
          { disabled: false, label: 'Published', value: 'published' },
        ],
        preload: false,
        relationship: null,
        schema: null,
        searchable: false,
      },
      type: 'select',
    }])
  })

  it('publishes configured resource actions on record and table surfaces', () => {
    const manifests = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        actions: [
          { authorize: () => true, confirmation: 'Publish this post?', handle: () => ({ published: true }), id: 'publish', kind: 'custom', label: 'Publish now', mount: 'record' },
          { authorize: () => true, color: 'warning', handle: () => ({ archived: true }), icon: 'archive', id: 'archive-selected', kind: 'custom', label: 'Archive selected', mount: 'bulk' },
        ],
        capabilities: { delete: true, forceDelete: false, restore: false },
        form: { fields: [] },
        id: 'posts',
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
        table: { columns: [] },
      },
    })
    const properties = manifests[0]?.body?.properties.resource
    const resource = properties && typeof properties === 'object' && !Array.isArray(properties) ? properties : null
    const actions = resource && Array.isArray(resource.actions) ? resource.actions : []
    const table = resource?.table && typeof resource.table === 'object' && !Array.isArray(resource.table) ? resource.table : null
    const tableActions = table && Array.isArray(table.actions) ? table.actions : []

    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ confirmation: 'Publish this post?', id: 'publish', label: 'Publish now', mount: 'record' }),
    ]))
    expect(tableActions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'publish', scope: 'row' }),
      expect.objectContaining({ color: 'warning', icon: 'archive', id: 'archive-selected', scope: 'bulk' }),
    ]))
  })

  it('uses configured infolist entries instead of deriving the view from form fields', () => {
    const manifests = generatedResourcePageManifests({
      panelPath: '/admin',
      resource: {
        actions: [],
        capabilities: { delete: true, forceDelete: false, restore: false },
        form: { fields: [{ label: 'Title', path: 'title', type: 'text' }] },
        id: 'posts',
        infolist: [entriesFor(PostRecord).boolean('active').label('Published')],
        kind: 'resource',
        model: { definition: { primaryKey: 'id' } },
        recordTitle: 'title',
        routeKey: 'id',
        table: { columns: [] },
      },
    })
    const properties = manifests[0]?.body?.properties.resource
    const resource = properties && typeof properties === 'object' && !Array.isArray(properties) ? properties : null
    const infolist = resource?.infolist && typeof resource.infolist === 'object' && !Array.isArray(resource.infolist) ? resource.infolist : null

    expect(infolist?.entries).toEqual([
      expect.objectContaining({ id: 'posts-active', label: 'Published', path: 'active', type: 'boolean' }),
    ])
  })

  it('executes only the configured server action with its submitted input', async () => {
    const handle = vi.fn((input: Readonly<Record<string, unknown>>) => ({ title: input.title }))
    const resource = {
      actions: [{ authorize: () => true, handle, id: 'publish', kind: 'custom', label: 'Publish', mount: 'page', transactional: false }],
      capabilities: { delete: true, forceDelete: false, restore: false },
      form: { fields: [] },
      id: 'posts',
      kind: 'resource',
      model: {
        definition: { name: 'Post', primaryKey: 'id', softDeletes: false },
        getConnectionName: () => undefined,
      },
      shared: true,
      table: { columns: [] },
    }
    const result = await executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: { actionId: 'publish', idempotencyKey: 'publish-1', input: { title: 'Ready' }, resourceId: 'posts' },
    })

    expect(handle).toHaveBeenCalledWith({ title: 'Ready' }, expect.objectContaining({ actor: { id: 'admin' }, mount: 'page' }))
    expect(result.data).toMatchObject({ result: { title: 'Ready' }, status: 'succeeded' })
    expect(result.effects).toEqual([])
  })

  it('selects the registered action by both ID and mount', async () => {
    const page = vi.fn(() => ({ source: 'page' }))
    const notification = vi.fn(() => ({ source: 'notification' }))
    const resource = {
      actions: [
        { authorize: () => true, handle: notification, id: 'publish', kind: 'custom', label: 'Publish', mount: 'notification', transactional: false },
        { authorize: () => true, handle: page, id: 'publish', kind: 'custom', label: 'Publish', mount: 'page', transactional: false },
      ],
      capabilities: { delete: true, forceDelete: false, restore: false },
      form: { fields: [] },
      id: 'posts',
      kind: 'resource',
      model: {
        definition: { name: 'Post', primaryKey: 'id', softDeletes: false },
        getConnectionName: () => undefined,
      },
      shared: true,
      table: { columns: [] },
    }

    const result = await executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: { actionId: 'publish', mount: 'page', resourceId: 'posts' },
    })

    expect(result.data).toMatchObject({ result: { source: 'page' } })
    expect(page).toHaveBeenCalledOnce()
    expect(notification).not.toHaveBeenCalled()
  })

  it('rejects omitted destructive actions without executing their mutation path', async () => {
    const remove = vi.fn()
    const resource = {
      actions: [],
      capabilities: { delete: true, forceDelete: false, restore: false },
      form: { fields: [] },
      id: 'posts',
      kind: 'resource',
      model: {
        definition: { name: 'Post', primaryKey: 'id', softDeletes: false },
        getConnectionName: () => undefined,
        query: () => ({ where: () => ({ first: async () => ({ delete: remove, toJSON: () => ({ id: 1 }) }) }) }),
      },
      shared: true,
      table: { columns: [] },
    }

    await expect(executeGeneratedResourceOperation(resource, {
      context: { actor: { id: 'admin' }, signal: new AbortController().signal, tenant: null },
      operation: 'action',
      panelId: 'admin',
      payload: { actionId: 'omitted-delete', intent: 'delete', recordIds: [1], resourceId: 'posts' },
    })).rejects.toThrow('not registered')
    expect(remove).not.toHaveBeenCalled()
  })

  it('compiles every text formatter as deterministic client state', () => {
    const manifest = columnsFor(PostRecord).text('title')
      .badge()
      .date({ dateStyle: 'short' })
      .time({ timeStyle: 'short' })
      .dateTime({ dateStyle: 'medium', timeStyle: 'short' })
      .relativeTime()
      .number({ maximumFractionDigits: 2 })
      .money('USD')
      .markdown()
      .list(' · ')
      .limit(80)
      .words(12)
      .lineClamp(3)
      .copyable()
      .icon('document-text')
      .color('primary')
      .prefix('$')
      .suffix(' USD')
      .tooltip('Gross total')
      .url('/posts/1')
      .action('posts.open')
      .compile().manifest

    expect(manifest.formatters.map(formatter => formatter.kind)).toEqual([
      'badge', 'date', 'time', 'date-time', 'relative-time', 'number', 'money', 'markdown', 'list', 'limit',
      'words', 'icon', 'color', 'prefix', 'suffix', 'tooltip', 'url', 'action',
    ])
    expect(manifest.copyable).toBe(true)
    expect(manifest.lineClamp).toBe(3)
    expect(serializeManifest(manifest)).toBe(serializeManifest(manifest))
  })

  it('formats lists, numbers, money, dates, relative values, limits, and affixes', () => {
    expect(formatTextValue(['one', 'two'], [{ kind: 'list', separator: ' / ' }])).toBe('one / two')
    expect(formatTextValue(1234.5, [{ kind: 'number', options: { maximumFractionDigits: 1 } }], { locale: 'en-US' })).toBe('1,234.5')
    expect(formatTextValue(12, [{ currency: 'USD', kind: 'money' }], { locale: 'en-US' })).toBe('$12.00')
    expect(formatTextValue('2026-07-26T00:00:00.000Z', [{ kind: 'relative-time' }], {
      locale: 'en',
      now: new Date('2026-07-27T00:00:00.000Z'),
    })).toBe('yesterday')
    expect(formatTextValue('one two three', [{ count: 2, kind: 'words' }, { kind: 'prefix', value: '[' }, { kind: 'suffix', value: ']' }])).toBe('[one two]')
    expect(formatTextValue('abcdef', [{ characters: 3, kind: 'limit' }])).toBe('abc…')
  })

  it('keeps callbacks and server-only state out of serialized manifests', () => {
    const state = vi.fn(() => 'computed')
    const tooltip = vi.fn(() => 'Private tooltip')
    const url = vi.fn(() => '/private')
    const action = vi.fn(() => 'posts.open')
    const definition = columnsFor(PostRecord).text('title')
      .state(state)
      .tooltip(tooltip)
      .url(url)
      .action(action)
      .compile()

    expect(definition.server).toEqual({ action, state, tooltip, url })
    const serialized = serializeManifest(definition.manifest)
    expect(serialized).not.toContain('Private tooltip')
    expect(serialized).not.toContain('computed')
    expect(serialized).not.toContain('posts.open')
    expect(() => columnsFor(PostRecord).text('title').url('javascript:alert(1)')).toThrow(/unsafe URL/)
  })

  it('escapes raw HTML before Markdown rendering boundaries', () => {
    expect(formatTextValue('<script>alert("x")</script>', [{ kind: 'markdown' }]))
      .toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
  })

  it('rejects malformed formatter and editor configuration', () => {
    expect(() => columnsFor(PostRecord).text('title').money('usd')).toThrow(/ISO 4217/)
    expect(() => columnsFor(PostRecord).image('cover').size(4096)).toThrow(/1 to 2048/)
    expect(() => columnsFor(PostRecord).select('status').editable('posts.status', [
      { label: 'One', value: 'same' },
      { label: 'Two', value: 'same' },
    ])).toThrow(/unique/)
    expect(() => columnsFor(PostRecord).textInput('title').editable('../unsafe')).toThrow(/stable action ID/)
  })
})

describe('P7-B secure inline editing', () => {
  it('delegates allow-listed updates to the normal action execution boundary', async () => {
    const column = columnsFor(PostRecord).toggle('active').editable('posts.toggle').compile().manifest
    const signal = new AbortController().signal
    const execute = vi.fn(async () => ({ active: true }))

    await expect(executeInlineColumnEdit(column, {
      action: 'posts.toggle',
      columnPath: 'active',
      expectedVersion: 'v3',
      recordId: 42,
      value: true,
    }, { execute }, signal)).resolves.toEqual({ active: true })
    expect(execute).toHaveBeenCalledWith({
      action: 'posts.toggle',
      columnPath: 'active',
      expectedVersion: 'v3',
      recordId: 42,
      value: true,
    }, signal)
  })

  it('rejects client-selected columns and actions before server execution', async () => {
    const column = columnsFor(PostRecord).toggle('active').editable('posts.toggle').compile().manifest
    const execute = vi.fn(async () => ({ active: true }))

    await expect(executeInlineColumnEdit(column, {
      action: 'admin.force-update',
      columnPath: 'active',
      recordId: 42,
      value: true,
    }, { execute })).rejects.toThrow(/different server action/)
    await expect(executeInlineColumnEdit(column, {
      action: 'posts.toggle',
      columnPath: 'author.is_admin',
      recordId: 42,
      value: true,
    }, { execute })).rejects.toThrow(/allow-listed compiled column/)
    expect(execute).not.toHaveBeenCalled()
  })
})
