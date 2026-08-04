import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  customEntryFrom,
  defineEntry,
  entriesFor,
  formatEntryState,
  resolveEntry,
  resolveEntrySource,
  type EntryRendererRegistryContract,
} from '../src/infolists/entries'

class PostRecord {
  declare readonly active: boolean
  declare readonly author: {
    readonly name: string
  }
  declare readonly body: string
  declare readonly metadata: {
    readonly color: string
    readonly views: number
  }
  declare readonly photos: readonly {
    readonly url: string
  }[]
  declare readonly title: string
}

describe('P8-A infolist entry definitions', () => {
  const entry = entriesFor(PostRecord)

  it('compiles common capabilities without serializing callbacks', () => {
    const definition = entry.text('title')
      .label('Title')
      .inlineLabel()
      .copyable()
      .default('Untitled')
      .placeholder('Missing')
      .prefix('# ')
      .limit(40)
      .tooltip(({ value }) => `Copy ${String(value)}`)
      .url(({ record }) => `/posts/${record.metadata.views}`)
      .action('view-post')
      .compile()

    expect(definition.manifest).toMatchObject({
      actions: ['view-post'],
      copyable: true,
      inlineLabel: true,
      label: 'Title',
      path: 'title',
      placeholder: 'Missing',
      type: 'text',
    })
    expect(JSON.stringify(definition.manifest)).not.toContain('=>')
    expect(definition.server.tooltip).toBeTypeOf('function')
    expect(definition.server.url).toBeTypeOf('function')
  })

  it('provides all built-in entry definitions', () => {
    expect([
      entry.text('title').compile().manifest.type,
      entry.icon('active').boolean().compile().manifest.type,
      entry.boolean('active').compile().manifest.type,
      entry.image('body').circular().size(64).compile().manifest.type,
      entry.color('title').compile().manifest.type,
      entry.code('body').language('typescript').lineNumbers().compile().manifest.type,
      entry.keyValue('metadata').compile().manifest.type,
      entry.repeatable('photos').schema(['url']).compile().manifest.type,
      entry.custom('acme:entry:rating', 'metadata.views', { maximum: 5 }).compile().manifest.type,
    ]).toEqual(['text', 'icon', 'boolean', 'image', 'color', 'code', 'key-value', 'repeatable', 'acme:entry:rating'])
  })

  it('compiles renderer capability metadata into stable properties', () => {
    expect(entry.text('title').badge().compile().manifest.properties).toMatchObject({ badge: true })
    expect(entry.icon('active').icon('star').compile().manifest.properties).toMatchObject({ icon: 'star' })
    expect(entry.boolean('active').icons('circle-check', 'circle-x').compile().manifest.properties).toMatchObject({
      falsyIcon: 'circle-x',
      truthyIcon: 'circle-check',
    })
    expect(entry.image('body').alt('Cover').circular().size(96).compile().manifest.properties).toMatchObject({
      alt: 'Cover',
      circular: true,
      size: 96,
    })
    expect(entry.code('body').language('typescript').lineNumbers().compile().manifest.properties).toMatchObject({
      language: 'typescript',
      lineNumbers: true,
    })
    expect(entry.keyValue('metadata').keyLabel('Attribute').valueLabel('Value').compile().manifest.properties).toMatchObject({
      keyLabel: 'Attribute',
      valueLabel: 'Value',
    })
    expect(entry.repeatable('photos').schema(['url']).compile().manifest.properties).toMatchObject({ schema: ['url'] })
  })

  it('compiles visibility, responsive layout, safe attributes, and deterministically ordered slots', () => {
    const manifest = entry.text('title')
      .hidden(false)
      .columnSpan({ default: 2, lg: 'full' })
      .columnStart({ lg: 1 })
      .extraAttributes({ 'data-summary': 'title', class: 'summary-entry' })
      .before({ component: 'entry-later', order: 2, properties: { marker: 'later' } })
      .before({ component: 'entry-first', order: -1, properties: { marker: 'first' } })
      .compile()
      .manifest

    expect(manifest).toMatchObject({
      dynamicVisibility: false,
      extraAttributes: { 'data-summary': 'title', class: 'summary-entry' },
      layout: {
        columnSpan: { default: 2, lg: 'full' },
        columnStart: { lg: 1 },
      },
      visible: true,
    })
    expect(manifest.slots.before?.map(reference => reference.component)).toEqual(['entry-first', 'entry-later'])
  })

  it('resolves paths, relationships, JSON, computed state, defaults, and placeholders', async () => {
    const record: PostRecord = {
      active: true,
      author: { name: 'Ada' },
      body: 'Hello',
      metadata: { color: '#fff', views: 2 },
      photos: [{ url: '/one.png' }, { url: '/two.png' }],
      title: 'Post',
    }
    expect(resolveEntrySource(record, { kind: 'path', path: 'metadata.views' })).toBe(2)
    expect(resolveEntrySource(record, { kind: 'json', path: 'metadata' })).toEqual({ color: '#fff', views: 2 })
    expect(resolveEntrySource(record, { kind: 'relationship', path: 'photos', titlePath: 'url' })).toEqual(['/one.png', '/two.png'])

    const computed = entry.text('title').state(({ record: current }) => `${current.title}!`, 'display-title').compile()
    expect(await resolveEntry(computed, record, 'en')).toBe('Post!')
    expect(await resolveEntry(entry.text('title').field('body').compile(), record, 'en')).toBe('Hello')
  })

  it('formats values without producing executable markup', () => {
    expect(formatEntryState('<img onerror=alert(1)>', [
      { kind: 'prefix', value: '<b>' },
      { characters: 12, kind: 'limit' },
    ])).toBe('<b><img oner')
    expect(formatEntryState(1200, [{ kind: 'number', options: { maximumFractionDigits: 0 } }], 'en')).toBe('1,200')
  })

  it('defines custom entries with a renderer-neutral registry contract', () => {
    const custom = defineEntry('acme:entry:rating', { maximum: 5 })
    const compiled = customEntryFrom<PostRecord, 'metadata.views', 'acme:entry:rating'>(custom, 'metadata.views').compile()
    expect(compiled.manifest.properties).toMatchObject({
      configuration: { maximum: 5 },
      formats: [{ configuration: { maximum: 5 }, kind: 'configuration' }],
    })
    expectTypeOf<EntryRendererRegistryContract<(state: unknown) => string>>().toHaveProperty('resolve')
  })

  it('rejects unsafe URLs, duplicate actions, and invalid custom IDs', () => {
    expect(() => entry.text('title').url('javascript:alert(1)')).toThrow('unsafe URL')
    expect(() => entry.text('title').url('/\\evil.example')).toThrow('unsafe URL')
    expect(() => entry.text('title').action('view').action('view')).toThrow('Duplicate entry action')
    expect(() => defineEntry('not-valid' as `${string}:entry:${string}`)).toThrow('namespace:entry:name')
  })
})
