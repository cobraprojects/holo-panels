import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import { resolveNavigation } from '../src/navigation/resolution'
import type { NavigationManifest } from '../src/navigation/contracts'
import { globalSearchFor, GlobalSearchEngine } from '../src/search/engine'
import type { GlobalSearchContext, GlobalSearchResultAuthorization, RegisteredGlobalSearchResource, SearchablePath } from '../src/search/contracts'

class Actor {
  declare readonly id: number
  declare readonly role: 'admin' | 'viewer'
}

class SearchRecord {
  declare readonly author: { readonly name: string }
  declare readonly id: number
  declare readonly image: string
  declare readonly tenant: string
  declare readonly title: string
  declare readonly visible: boolean
}

class SearchQuery {
  declare readonly records: readonly SearchRecord[]
  declare readonly tenant: string | null
  declare readonly term: string
}

const signal = new AbortController().signal

describe('P11-A navigation and clusters', () => {
  it('resolves authorized generated items, variants, hierarchy, badges, clusters, modes, and panel switching deterministically', async () => {
    const manifest = await resolveNavigation({
      clusters: [
        { id: 'content', label: 'Content', sort: 20 },
        { authorize: context => context.actor.role === 'admin', collapsible: false, id: 'system', label: 'System', sort: 30 },
      ],
      collapsible: true,
      context: { activePath: '/admin/posts/42/edit', actor: { id: 1, role: 'admin' as const }, panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme' },
      items: [
        { id: 'posts.edit', kind: 'resource', label: 'Edit post', parent: 'posts', path: '/admin/posts/42/edit', sort: 20, variant: 'edit' },
        { badge: () => ' 7 ', cluster: 'content', group: 'Publishing', icon: 'document', id: 'posts', kind: 'resource', label: 'Posts', path: '/admin/posts', sort: 20 },
        { group: 'Overview', id: 'dashboard', kind: 'dashboard', label: 'Dashboard', path: '/admin', sort: 10 },
        { authorize: () => false, cluster: 'system', id: 'secrets', kind: 'page', label: 'Secrets', path: '/admin/secrets', sort: 30 },
      ],
      layout: 'topbar',
      panels: [
        { id: 'vendor', label: 'Vendor', path: '/vendor', sort: 20 },
        { id: 'admin', label: 'Admin', path: '/admin', sort: 10 },
        { authorize: () => false, id: 'secret', label: 'Secret', path: '/secret', sort: 30 },
      ],
    })

    expectTypeOf(manifest).toEqualTypeOf<NavigationManifest>()
    expect(manifest).toMatchObject({ activeItemId: 'posts.edit', collapsible: true, layout: 'topbar', panelId: 'admin' })
    expect(manifest.items.map(item => [item.id, item.badge, item.active])).toEqual([
      ['dashboard', null, true],
      ['posts.edit', null, true],
      ['posts', '7', true],
    ])
    expect(manifest.groups.map(group => [group.id, group.active])).toEqual([['Overview', true], ['Publishing', true]])
    expect(manifest.clusters.map(cluster => [cluster.id, cluster.active, cluster.collapsible])).toEqual([
      ['content', true, true],
      ['system', false, false],
    ])
    expect(manifest.panels.map(panel => [panel.id, panel.active])).toEqual([['admin', true], ['vendor', false]])
    expect(Object.isFrozen(manifest.items)).toBe(true)
  })

  it('rejects collisions, cycles, unknown parents and clusters, and cross-panel destinations', async () => {
    const context = { activePath: '/admin', actor: {}, panelId: 'admin', panelPath: '/admin', signal, tenant: null }
    await expect(resolveNavigation({ context, items: [
      { id: 'posts', kind: 'resource', label: 'Posts', path: '/admin/posts' },
      { id: 'posts', kind: 'page', label: 'Other', path: '/admin/other' },
    ] })).rejects.toThrow('Duplicate')
    await expect(resolveNavigation({ context, items: [
      { id: 'first', kind: 'page', label: 'First', parent: 'second', path: '/admin/first' },
      { id: 'second', kind: 'page', label: 'Second', parent: 'first', path: '/admin/second' },
    ] })).rejects.toThrow('cycle')
    await expect(resolveNavigation({ context, items: [{ id: 'child', kind: 'page', label: 'Child', parent: 'missing', path: '/admin/child' }] })).rejects.toThrow('not registered')
    await expect(resolveNavigation({ context, items: [{ cluster: 'missing', id: 'posts', kind: 'resource', label: 'Posts', path: '/admin/posts' }] })).rejects.toThrow('cluster')
    await expect(resolveNavigation({ context, items: [{ id: 'escape', kind: 'page', label: 'Escape', path: '/vendor' }] })).rejects.toThrow('inside panel')
  })

  it('removes an authorized descendant chain beneath a denied ancestor without resolving descendant badges', async () => {
    const parentBadge = vi.fn(() => 'parent-secret')
    const childBadge = vi.fn(() => 'child-secret')
    const manifest = await resolveNavigation({
      context: { activePath: '/admin', actor: {}, panelId: 'admin', panelPath: '/admin', signal, tenant: null },
      items: [
        { authorize: () => false, id: 'restricted', kind: 'page', label: 'Restricted', path: '/admin/restricted' },
        { badge: parentBadge, id: 'restricted.parent', kind: 'page', label: 'Parent', parent: 'restricted', path: '/admin/restricted/parent' },
        { badge: childBadge, id: 'restricted.child', kind: 'page', label: 'Child', parent: 'restricted.parent', path: '/admin/restricted/parent/child' },
      ],
    })

    expect(manifest.items).toEqual([])
    expect(parentBadge).not.toHaveBeenCalled()
    expect(childBadge).not.toHaveBeenCalled()
  })
})

describe('P11-B global search', () => {
  function registration(options: {
    readonly authorizeResults?: (records: readonly SearchRecord[], context: GlobalSearchContext<Actor, string>) => readonly GlobalSearchResultAuthorization[] | Promise<readonly GlobalSearchResultAuthorization[]>
    readonly execute?: (query: SearchQuery, limit: number) => Promise<readonly SearchRecord[]>
    readonly loadRelations?: (records: readonly SearchRecord[], paths: readonly string[], context: GlobalSearchContext<Actor, string>) => Promise<void>
    readonly order?: string[]
    readonly panelId?: string
    readonly resultUrl?: (record: SearchRecord) => string
  } = {}): RegisteredGlobalSearchResource<Actor, string> {
    const records: readonly SearchRecord[] = [
      { author: { name: 'Ada' }, id: 1, image: '/images/one.png', tenant: 'acme', title: 'Public post', visible: true },
      { author: { name: 'Grace' }, id: 2, image: '/images/two.png', tenant: 'acme', title: 'Hidden post', visible: false },
      { author: { name: 'Other' }, id: 3, image: '/images/three.png', tenant: 'other', title: 'Other tenant', visible: true },
    ]
    return globalSearchFor({ actor: Actor, query: SearchQuery, record: SearchRecord, tenant: String })({
      actions: [
        { id: 'edit', label: 'Edit', url: record => `/admin/posts/${record.id}/edit` },
        { id: 'delete', label: 'Delete', url: record => `/admin/posts/${record.id}/delete` },
      ],
      applySearch: (query, term) => {
        options.order?.push('search')
        return { ...query, term }
      },
      attributes: ['title', 'author.name'],
      authorizeResource: context => context.actor.role === 'admin',
      authorizeResults: options.authorizeResults ?? ((records, context) => records.map(record => ({
        actions: record.id === 1 && context.actor.role === 'admin' ? ['edit', 'delete'] : [],
        page: record.id !== 99,
        result: record.visible,
      }))),
      createQuery: () => {
        options.order?.push('query')
        return { records, tenant: null, term: '' }
      },
      details: [{ label: 'Author', path: 'author.name' }],
      execute: async (query, limit) => {
        options.order?.push('execute')
        if (options.execute) return await options.execute(query, limit)
        return query.records.filter(record => record.tenant === query.tenant && `${record.title} ${record.author.name}`.toLowerCase().includes(query.term.toLowerCase())).slice(0, limit)
      },
      guard: 'staff',
      icon: 'document',
      id: 'posts',
      image: 'image',
      loadRelations: options.loadRelations ?? vi.fn(async () => undefined),
      panelId: options.panelId ?? 'admin',
      resultId: 'id',
      resultUrl: options.resultUrl ?? (record => `/admin/posts/${record.id}`),
      scopeAuthorization: query => {
        options.order?.push('authorization')
        return query
      },
      scopeTenant: (query, context) => {
        options.order?.push('tenant')
        return { ...query, tenant: context.tenant }
      },
      title: 'title',
    })
  }

  it('applies guard, panel, resource policy, tenant scope, result policy, relation batching, projection, actions, and panel isolation', async () => {
    const loadRelations = vi.fn(async () => undefined)
    const order: string[] = []
    const otherPanel = registration({ panelId: 'vendor' })
    const engine = new GlobalSearchEngine([registration({ loadRelations, order }), otherPanel], {
      authorizeGuard: context => context.guard === 'staff',
      authorizePanel: context => context.actor.role === 'admin',
    })
    const response = await engine.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: ' pUbLiC  ' })

    expect(response.term).toBe('pUbLiC')
    expect(response.results).toEqual([{
      actions: [
        { id: 'edit', label: 'Edit', url: '/admin/posts/1/edit' },
        { id: 'delete', label: 'Delete', url: '/admin/posts/1/delete' },
      ],
      details: { Author: 'Ada' },
      icon: 'document',
      id: '1',
      image: '/images/one.png',
      resourceId: 'posts',
      title: 'Public post',
      url: '/admin/posts/1',
    }])
    expect(loadRelations).toHaveBeenCalledOnce()
    expect(loadRelations).toHaveBeenCalledWith(expect.any(Array), ['author'], expect.objectContaining({ panelId: 'admin', tenant: 'acme' }))
    expect(order).toEqual(['query', 'tenant', 'authorization', 'search', 'execute'])
  })

  it('fails closed for search length, panel and guard access, resource access, aborted requests, and unsafe result pages', async () => {
    const engine = new GlobalSearchEngine([registration()], { authorizeGuard: () => true, authorizePanel: () => true })
    await expect(engine.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'x' })).rejects.toThrow('2 to 200')
    await expect(engine.search({ actor: { id: 1, role: 'viewer' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'Public' })).resolves.toMatchObject({ results: [] })
    await expect(new GlobalSearchEngine([registration()], { authorizeGuard: () => false, authorizePanel: () => true }).search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'Public' })).rejects.toThrow('not authorized')

    const aborted = new AbortController()
    aborted.abort(new Error('cancelled'))
    await expect(engine.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal: aborted.signal, tenant: 'acme', term: 'Public' })).rejects.toThrow('cancelled')

    const hostile = new GlobalSearchEngine([registration({ resultUrl: () => '/vendor/posts/1' })], { authorizeGuard: () => true, authorizePanel: () => true })
    await expect(hostile.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'Public' })).rejects.toThrow('inside the panel')
  })

  it('rejects resource adapters that return more records than requested before loading relations or projecting results', async () => {
    const loadRelations = vi.fn(async () => undefined)
    const engine = new GlobalSearchEngine([registration({
      execute: async query => query.records,
      loadRelations,
    })], { authorizeGuard: () => true, authorizePanel: () => true }, { maximumResults: 1 })

    await expect(engine.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'Public' }))
      .rejects.toThrow('exceeded the requested result limit')
    expect(loadRelations).not.toHaveBeenCalled()
  })

  it('authorizes a result batch once and rejects malformed decisions without partial results', async () => {
    const authorizeResults = vi.fn((records: readonly SearchRecord[]) => records.map(record => ({
      actions: record.id === 1 ? ['edit'] : [],
      page: true,
      result: record.visible,
    })))
    const engine = new GlobalSearchEngine([registration({ authorizeResults })], { authorizeGuard: () => true, authorizePanel: () => true })

    await expect(engine.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'post' }))
      .resolves.toMatchObject({ results: [{ actions: [{ id: 'edit' }], id: '1' }] })
    expect(authorizeResults).toHaveBeenCalledOnce()
    expect(authorizeResults.mock.calls[0]?.[0]).toHaveLength(2)

    const malformed = new GlobalSearchEngine([registration({ authorizeResults: () => [] })], { authorizeGuard: () => true, authorizePanel: () => true })
    await expect(malformed.search({ actor: { id: 1, role: 'admin' }, guard: 'staff', panelId: 'admin', panelPath: '/admin', signal, tenant: 'acme', term: 'post' }))
      .rejects.toThrow('Global search authorization failed')
  })
})
