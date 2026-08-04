import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { componentDefault, definePanelsConfig } from '../src/defaults/component-default'
import { defineCustomPage, defineListPage, type PageBuilder } from '../src/pages/page'
import { definePanel, type PanelBuilder } from '../src/panels/panel'
import { definePanelPlugin, type PanelPluginBuilder } from '../src/plugins/panel-plugin'
import { createExtensionTypeId } from '../src/plugins/type-id'
import type { JsonObject } from '../src/protocol/json'
import { ResourceBuilder } from '../src/resources/builder'
import type { ResourceModelDefinition, ResourceQuery, ResourceRecord } from '../src/resources/contracts'
import { ResourceExecutor } from '../src/resources/executor'

const compatibility = {
  panels: { maximumExclusive: '2.0.0', minimum: '1.0.0' },
  protocol: { maximumExclusive: '2.0', minimum: '1.0' },
}

class TestRecord implements ResourceRecord {
  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  async restore(): Promise<this> { return this }
  toJSON(): { readonly id: number, readonly title: string } { return { id: 1, title: 'Post' } }
  async update(_values: never): Promise<this> { return this }
}

interface TestQuery extends ResourceQuery<TestQuery, TestRecord> {
  readonly tenant?: number
}

const model = {
  create: async () => new TestRecord(),
  definition: {
    fillable: ['title'],
    name: 'Post',
    primaryKey: 'id',
    softDeletes: false,
  } satisfies ResourceModelDefinition,
  getConnectionName: () => undefined,
  query: (): TestQuery => ({ first: async () => undefined }),
  async unguarded<TResult>(callback: () => Promise<TResult>): Promise<TResult> { return callback() },
}

function resource(): ResourceBuilder<typeof model, TestRecord, TestQuery, { readonly title?: string }, object, unknown, false> {
  return new ResourceBuilder(model)
}

describe('P16 plugin authoring', () => {
  it('collects typed contributions and becomes immutable after installation', () => {
    const apply = vi.fn((builder: object) => builder)
    const defaultValue = componentDefault('field', 'text', apply)
    const page = defineCustomPage('reports', { load: () => ({}) }).compile()
    const definition = resource().shared().writableAttributes(['title']).compileDiscoveryDefinition()
    const fieldType = createExtensionTypeId('acme.money', 'field', 'currency')
    const plugin = definePanelPlugin({ compatibility, id: 'acme.money', packageName: '@acme/panels-money' })
      .resources(definition)
      .pages(page)
      .extension({ compatibility, kind: 'field', pluginId: 'acme.money', typeId: fieldType })
      .renderer({ exportName: 'CurrencyField', framework: 'react', module: './react.js', typeId: fieldType })
      .translation({ catalog: { currency: 'Currency' }, locale: 'en', namespace: 'acme.money' })
      .asset({ id: 'money-style', kind: 'style', load: 'eager', source: './money.css' })
      .defaults(defaultValue)
      .permissionSubject({ id: 'payments', operations: ['view'], subject: 'resource' })
      .generatorTemplate({ exportName: 'generateMoneyField', generator: 'field', module: './generator.js' })
      .cliCommand({ exportName: 'moneyCommand', id: 'money', module: './cli.js' })
      .migration({ exportName: 'up', id: 'create-money', module: './migration.js' })

    expectTypeOf(plugin).toEqualTypeOf<PanelPluginBuilder>()
    const installation = plugin.install({ guard: 'web', id: 'admin' })
    expect(installation.contributions.map(contribution => contribution.kind)).toEqual([
      'resource',
      'page',
      'extension',
      'renderer',
      'translation',
      'asset',
      'default',
      'permission-subject',
      'generator-template',
      'cli-command',
      'migration',
    ])
    expect(() => plugin.defaults(defaultValue)).toThrow('immutable after installation')
  })

  it('rejects duplicate contribution IDs and unsafe package paths', () => {
    const plugin = definePanelPlugin({ compatibility, id: 'acme.money', packageName: '@acme/panels-money' })
      .asset({ id: 'money-style', kind: 'style', load: 'eager', source: './money.css' })

    expect(() => plugin.asset({ id: 'money-style', kind: 'style', load: 'lazy', source: './other.css' })).toThrow('Duplicate')
    expect(() => definePanelPlugin({ compatibility, id: 'acme.money', packageName: '../money' })).toThrow('npm package')
    expect(() => definePanelPlugin({ compatibility, id: 'acme.money', packageName: '@acme/money' })
      .asset({ id: 'escape', kind: 'script', load: 'eager', source: './../escape.js' })).toThrow('package-relative')
  })
})

describe('P16 defaults and scoped registrations', () => {
  it('retains server-only defaults and ordered panel slots outside executable client values', () => {
    const apply = (builder: object): object => builder
    const defaultValue = componentDefault('field', 'text', apply)
    const configuration = definePanelsConfig({ defaults: [defaultValue] })
    const panel = definePanel('admin')
      .defaults(defaultValue)
      .slot('topbar-after', 'app.user-menu')
      .slot('topbar-after', { component: 'app.notifications', order: -10, properties: { compact: true } })
      .compile()

    expect(configuration.defaults).toEqual([defaultValue])
    expect(panel.manifest.slots['topbar-after']).toEqual([
      { component: 'app.notifications', order: -10, properties: { compact: true }, source: 'panel' },
      { component: 'app.user-menu', order: 0, properties: {}, source: 'panel' },
    ])
    expect(panel.server.defaults).toEqual([defaultValue])
    expect(JSON.stringify(panel.manifest)).not.toContain('apply')
    expect(() => componentDefault<object>('field', 'text', () => []).apply({})).toThrow('same concrete builder subtype')
  })

  it('creates independent configured pages and appends JSON-safe page slots', () => {
    const original = defineCustomPage('dashboard').title('Dashboard').slot('above-content', 'app.banner')
    const variant = original.configured('regional-dashboard', page => page
      .path('/regional')
      .slot('above-content', { component: 'app.region', order: 20 }))

    expectTypeOf(variant).toEqualTypeOf<PageBuilder>()
    expect(original.compile().manifest).toMatchObject({ id: 'dashboard', path: '/dashboard' })
    expect(variant.compile().manifest).toMatchObject({ id: 'regional-dashboard', path: '/regional' })
    expect(variant.compile().manifest.slots['above-content']).toHaveLength(2)
    expect(() => defineCustomPage('duplicate').slot('above-content', 'app.banner').slot('above-content', 'app.banner')).toThrow('Duplicate')
  })

  it('registers configured resource and page variants independently in multiple panels', () => {
    const baseResource = resource().shared().writableAttributes(['title'])
    const archivedResource = baseResource.configured('archived-posts', configured => configured
      .slug('archive')
      .navigation({ label: 'Archived posts' }))
    const basePage = defineCustomPage('reports').path('/reports')
    const regionalPage = basePage.configured('regional-reports', configured => configured.path('/regional-reports'))
    const plugin = definePanelPlugin({ compatibility, id: 'acme.catalog', packageName: '@acme/panels-catalog' })
      .resources(baseResource.compileDiscoveryDefinition(), archivedResource.compileDiscoveryDefinition())
      .pages(basePage.compile(), regionalPage.compile())

    const admin = definePanel('admin').plugin(plugin).compile()
    const vendor = definePanel('vendor').plugin(plugin).compile()
    const adminInstallation = admin.server.plugins[0]!
    const vendorInstallation = vendor.server.plugins[0]!
    const contributionIds = adminInstallation.contributions
      .filter(contribution => 'definition' in contribution)
      .map(contribution => contribution.definition.id)

    expect(contributionIds).toEqual(['posts', 'archived-posts', 'reports', 'regional-reports'])
    expect(vendorInstallation.contributions).toEqual(adminInstallation.contributions)
    expect(vendorInstallation).not.toBe(adminInstallation)
    expect(admin.manifest.id).toBe('admin')
    expect(vendor.manifest.id).toBe('vendor')
    expect(baseResource.compile().slug).toBe('posts')
    expect(archivedResource.compile().slug).toBe('archive')
    expect(basePage.compile().manifest.path).toBe('/reports')
    expect(regionalPage.compile().manifest.path).toBe('/regional-reports')
  })

  it('defines mutually exclusive singular and nested resource scopes', async () => {
    const resolve = vi.fn(async (query: TestQuery) => query.tenant === 9 ? new TestRecord() : null)
    const singular = resource()
      .shared()
      .writableAttributes(['title'])
      .baseQuery(query => ({ ...query, tenant: 9 }))
      .singular({ resolve })
      .slot('form-before', 'app.account-notice')
      .compile()

    expect(singular.singular?.resolve).toBe(resolve)
    expect(singular.slots['form-before']).toEqual([
      { component: 'app.account-notice', order: 0, properties: {}, source: 'resource' },
    ])
    const authorizeClass = vi.fn(async () => undefined)
    const authorizeRecord = vi.fn(async () => undefined)
    const executor = new ResourceExecutor(singular, { authorization: { authorizeClass, authorizeRecord } })
    const context = { actor: {}, signal: new AbortController().signal, tenant: null }
    await expect(executor.serialize('client-id-is-ignored', context)).resolves.toEqual({ id: 1, title: 'Post' })
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ tenant: 9 }), context)
    expect(authorizeClass).toHaveBeenCalledBefore(authorizeRecord)
    await expect(executor.create({ title: 'Forbidden' }, context)).rejects.toThrow('do not support create')
    expect(() => resource().singular({ resolve }).pages(defineListPage('posts'))).toThrow('list or create')

    const scope = vi.fn((query: TestQuery, _parent: TestRecord) => ({ ...query, tenant: 7 }))
    const nested = resource()
      .shared()
      .writableAttributes(['title'])
      .nestedUnder<TestRecord>({ id: 'accounts', routeKey: 'id' }, { relationship: 'posts', scope })
      .compile()

    expect(nested.nested).toMatchObject({ options: { parameter: 'accounts-record', relationship: 'posts' }, parent: { id: 'accounts', routeKey: 'id' } })
    expect(() => resource().singular({ resolve }).nestedUnder<TestRecord>(
      { id: 'accounts', routeKey: 'id' },
      { relationship: 'posts', scope },
    )).toThrow('mutually exclusive')
  })

  it('preserves concrete panel builder types', () => {
    expectTypeOf(definePanel('admin').slot('footer', 'app.footer')).toEqualTypeOf<PanelBuilder>()
  })
})
