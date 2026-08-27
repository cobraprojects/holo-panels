import { ActionEngine, ResourceBuilder, definePanel, definePanelPlugin, defineStatsWidget, entriesFor, generatedResourcePageManifests, resolvePageData, resolveWidget } from '@holo-js/panels-core'
import { createGeneratedResourcePage, executeGeneratedWidgetOperation, executeWidgetAction } from '@holo-js/panels-core/server'
import { Grid, Schema } from '@holo-js/panels-schemas'
import { describe, expect, it, vi } from 'vitest'
import { createActionFactory } from '../src'

class Post {
  constructor(readonly id: number, readonly status: string) {}
  async delete(): Promise<void> {}
  async forceDelete(): Promise<void> {}
  async restore(): Promise<this> { return this }
  async update(): Promise<this> { return this }
  toJSON(): { id: number, status: string } { return { id: this.id, status: this.status } }
}

describe('action host registration', () => {
  it('dispatches widget actions only through the panel registry and rejects forged mounts', async () => {
    const publish = createActionFactory().Action.make('publish').action(() => ({ published: true }))
    const widget = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] })).compile()
    const registry = { 'admin:widget:overview': async () => widget }
    const panel = definePanel('admin').compile()
    const context = { actor: {}, locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: null }
    const payload = { actionId: 'publish', idempotencyKey: 'publish', input: {}, mount: 'page', widgetId: 'overview' }
    const transaction = { run: <TResult>(operation: () => Promise<TResult>) => operation() }
    expect(await executeGeneratedWidgetOperation(registry, payload, context, panel, transaction)).toMatchObject({ data: { result: { published: true }, status: 'succeeded' } })
    await expect(executeGeneratedWidgetOperation(registry, { ...payload, widgetId: 'missing' }, context, panel)).rejects.toThrow('not registered')
    await expect(executeGeneratedWidgetOperation(registry, payload, { ...context, panelId: 'other' }, panel)).rejects.toThrow('match their panel')
    await expect(executeGeneratedWidgetOperation(registry, { ...payload, mount: 'record', recordIds: [7] }, context, panel)).rejects.toThrow('page mount')
  })

  it('enforces discovered widget and action permissions before executing', async () => {
    const handler = vi.fn(() => null)
    const publish = createActionFactory().Action.make('publish').action(handler)
    const builder = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] }))
    expect(builder.compileDiscoveryDefinition().permissionKeys).toEqual(['widgets.overview.view'])
    expect(builder.compileDiscoveryDefinition().permissionReferences).toEqual(['actions.publish.view'])
    const widget = builder.compile()
    let denied = 'widgets.overview.view'
    const authorize = vi.fn(({ permission }: { readonly permission: string }) => { if (permission === denied) throw new Error('Permission denied') })
    const plugin = definePanelPlugin({ compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, id: 'permissions', packageName: 'test-permissions' }).authorization({ authorize, id: 'permissions' })
    const panel = definePanel('admin').plugins([plugin]).compile()
    const context = { actor: { id: 1 }, locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: null }
    const payload = { actionId: 'publish', idempotencyKey: 'publish', input: {}, mount: 'page', widgetId: 'overview' }
    const registry = { 'admin:widget:overview': async () => widget }
    await expect(executeGeneratedWidgetOperation(registry, payload, context, panel)).rejects.toThrow('Permission denied')
    denied = 'actions.publish.view'
    await expect(executeGeneratedWidgetOperation(registry, payload, context, panel)).rejects.toThrow('Permission denied')
    expect(handler).not.toHaveBeenCalled()
  })

  it('deduplicates widget retries for the same identity and preserves rate limits between requests', async () => {
    const handler = vi.fn(() => ({ published: true }))
    const publish = createActionFactory().Action.make('publish').action(handler)
    const compiled = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] })).compile()
    const widget = { ...compiled, server: { ...compiled.server, actions: compiled.server.actions?.map(action => ({ ...action, rateLimit: { key: () => 'actor-1', limit: 1, windowMilliseconds: 60_000 } })) } }
    const context = { actor: { id: 1 }, locale: 'en', panelId: 'admin', provider: 'users', services: {}, signal: new AbortController().signal, tenant: { id: 2 } }
    const request = { actionId: 'publish', idempotencyKey: 'publish', input: {}, mount: 'page' as const }
    const transaction = { run: <TResult>(operation: () => Promise<TResult>) => operation() }
    await Promise.all([executeWidgetAction(widget, request, context, transaction), executeWidgetAction(widget, request, { ...context, actor: { id: 1 }, tenant: { id: 2 } }, transaction)])
    expect(handler).toHaveBeenCalledOnce()
    await expect(executeWidgetAction(widget, { ...request, idempotencyKey: 'next' }, context, transaction)).rejects.toThrow('rate limit')
  })

  it('retains entry actions in resource registration and resolves them for the authorized record page', async () => {
    const publish = createActionFactory<Post>().Action.make('publish').label(({ record }) => `Publish ${record?.id}`).action(() => null)
    const entry = entriesFor(Post).text('status').action(publish)
    const post = new Post(7, 'draft')
    const query = { first: async () => post, where: () => query }
    const model = {
      create: async () => post,
      definition: { name: 'Post', primaryKey: 'id', softDeletes: false as const },
      getConnectionName: () => undefined,
      query: () => query,
      unguarded: <TResult>(operation: () => Promise<TResult>) => operation(),
    }
    const widget = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] }))
    const resource = new ResourceBuilder<typeof model, Post, typeof query>(model).shared().writableAttributes(['status']).infolist(new Schema<Post>().components([Grid.make<Post>().schema([entry])])).widgets(widget).compile()
    expect(resource.actions).toMatchObject([{ id: 'publish', mount: 'record', source: 'infolist:status' }])
    expect(resource.permissionReferences).toEqual(['actions.publish.view', 'widgets.overview.view'])
    const manifest = generatedResourcePageManifests({ panelPath: '/admin', resource }).find(page => page.pageType === 'view')
    if (!manifest) throw new Error('Expected a generated view page')
    const page = createGeneratedResourcePage(resource, manifest)
    const result = await resolvePageData(page, { actor: {}, locale: 'en', panelId: 'admin', parameters: { record: '7' }, services: {}, signal: new AbortController().signal, tenant: null })
    expect(result.manifest.body?.properties.resource).toMatchObject({
      infolist: { entries: [{ actionManifests: [{ id: 'publish', label: 'Publish 7', mount: 'record' }] }] },
    })
  })

  it('executes only registered widget actions and reauthorizes the widget and action', async () => {
    let allowed = true
    const publish = createActionFactory().Action.make('publish')
      .authorize(() => allowed)
      .action(() => ({ published: true }))
    const widget = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] })).compile()
    const context = { actor: {}, locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: null }
    const request = { actionId: 'publish', idempotencyKey: 'publish', input: {}, mount: 'page' as const }
    const transaction = { run: <TResult>(operation: () => Promise<TResult>) => operation() }
    expect(await executeWidgetAction(widget, request, context, transaction)).toMatchObject({ result: { published: true }, status: 'succeeded' })
    allowed = false
    await expect(executeWidgetAction(widget, request, context, transaction)).rejects.toThrow('not authorized')
    const empty = defineStatsWidget('overview').data(() => ({ stats: [] })).compile()
    await expect(executeWidgetAction(empty, request, context, transaction)).rejects.toThrow('not registered')
    const denied = defineStatsWidget('overview').authorize(() => false).actions([publish]).data(() => ({ stats: [] })).compile()
    await expect(executeWidgetAction(denied, request, context, transaction)).rejects.toThrow('not authorized')
  })

  it('resolves registered widget actions without exposing executable definitions', async () => {
    const publish = createActionFactory<Post>().Action.make('publish')
      .label(({ record }) => record ? 'Publish record' : 'Publish all')
      .action(() => ({ published: true }))
    const widget = defineStatsWidget('overview').actions([publish]).data(() => ({ stats: [] })).compile()
    const context = { actor: {}, locale: 'en', panelId: 'admin', services: {}, signal: new AbortController().signal, tenant: null }
    const resolved = await resolveWidget(widget, context)
    expect(resolved.actions).toMatchObject([{ id: 'publish', label: 'Publish all', mount: 'page' }])
    expect(JSON.stringify(resolved)).not.toContain('handle')
    expect(widget.server.actions).toHaveLength(1)
    expect(defineStatsWidget('empty').data(() => ({ stats: [] })).compile().server.actions).toEqual([])
  })

  it('registers an entry action without putting its execution callback in the entry manifest', async () => {
    const publish = createActionFactory<Post>().Action.make('publish')
      .label('Publish post')
      .action((_data, { record }) => ({ published: record?.id }))
    const entry = entriesFor(Post).text('status').action(publish).compile()
    expect(entry.manifest.actions).toEqual(['publish'])
    expect(JSON.stringify(entry.manifest)).not.toContain('handle')
    const action = entry.server.actions?.[0]
    if (!action) throw new Error('Expected the entry action to be registered')
    const engine = new ActionEngine<Post, number, object, null, object>({
      records: { resolve: async id => new Post(id, 'draft'), version: () => null },
      transaction: { run: operation => operation() },
    })
    expect(await engine.execute(action, {
      idempotencyKey: 'publish-post',
      input: {},
      mount: 'record',
      recordIds: [7],
    }, { actor: {}, services: {}, signal: new AbortController().signal, tenant: null })).toMatchObject({
      items: [{ recordId: 7, result: { published: 7 }, status: 'succeeded' }],
    })
  })
})
