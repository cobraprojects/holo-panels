import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { serializeManifest } from '../src/protocol/serialization'
import {
  type BooleanColumn,
  type CheckboxColumn,
  type ColorColumn,
  type CustomColumn,
  type IconColumn,
  type ImageColumn,
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
  declare author: {
    email: string
    name: string
  }
  declare comments: readonly {
    body: string
    score: number
  }[]
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
