import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { componentDefault, defineAction, definePanelsConfig, defineStatsWidget } from '@holo-js/panels-core'
import { DiscoveryCompiler } from '../../src/discovery/compiler'
import { PanelsDiscoveryError } from '../../src/discovery/error'
import {
  isClusterDefinition,
  isExportDefinition,
  isImportDefinition,
  isPageDefinition,
  isPanelDefinition,
  isPluginDefinition,
  isRelationManagerDefinition,
  isResourceDefinition,
  isWidgetDefinition,
  markDiscoverableDefinition,
} from '../../src/discovery/markers'
import type { DiscoverableDefinition, DiscoveryModule, DiscoveryModuleLoadContext } from '../../src/discovery/types'
import { PANEL_ARTIFACT_NAMES } from '../../src/generated/render'
import { loadGeneratedPanelsRegistry } from '../../src/generated/registry'

const temporaryDirectories: string[] = []

type DefinitionInput = Omit<DiscoverableDefinition, 'discoveryMarker'>

function definition(input: DefinitionInput): DiscoverableDefinition {
  return markDiscoverableDefinition(input)
}

async function createProject(): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-discovery-'))
  temporaryDirectories.push(projectRoot)
  return projectRoot
}

async function touch(projectRoot: string, projectPath: string): Promise<void> {
  const absolutePath = join(projectRoot, projectPath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, 'export default null\n')
}

function moduleLoader(
  projectRoot: string,
  modules: Map<string, DiscoveryModule>,
  loadedPaths: string[] = [],
): (absolutePath: string) => DiscoveryModule {
  return (absolutePath) => {
    const projectPath = relative(projectRoot, absolutePath).replaceAll('\\', '/')
    loadedPaths.push(projectPath)
    return modules.get(projectPath) ?? {}
  }
}

async function basicProject(): Promise<{
  projectRoot: string
  modules: Map<string, DiscoveryModule>
}> {
  const projectRoot = await createProject()
  const modules = new Map<string, DiscoveryModule>()
  const commentsRelationManager = { relationship: 'comments' }
  const entries: readonly [string, DiscoveryModule][] = [
    ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin', default: true, discover: {}, route: '/admin', client: { label: 'Admin', path: '/admin' }, server: { routeDomain: null, routePrefix: null, routes: [{ method: 'GET', path: '/health', scope: 'public' }] } }) }],
    ['server/admin/resources/posts/PostResource.mts', { default: {
      ...definition({ kind: 'resource', id: 'posts', componentKeys: ['posts.form'], permissionKeys: ['admin.posts.viewAny'] }),
      model: { definition: { name: 'Post', table: { tableName: 'posts' } } },
      relations: [commentsRelationManager],
    } }],
    ['server/admin/resources/posts/pages/ListPosts.ts', { ListPosts: definition({ kind: 'page', id: 'posts.list', route: '/posts' }) }],
    ['server/admin/resources/posts/relation-managers/CommentsRelationManager.cts', { default: {
      ...definition({ kind: 'relation-manager', id: 'posts.comments' }),
      relationName: 'comments',
    } }],
    ['server/admin/resources/posts/widgets/PostStats.js', { default: definition({ kind: 'widget', id: 'post-stats', client: { component: 'stats-card' } }) }],
    ['server/admin/pages/Dashboard.mjs', { default: definition({ kind: 'page', id: 'dashboard', route: '/' }) }],
    ['server/admin/widgets/AccountStats.cjs', { default: definition({ kind: 'widget', id: 'account-stats' }) }],
    ['server/admin/clusters/Settings.ts', { default: definition({ kind: 'cluster', id: 'settings', navigationKeys: ['settings'] }) }],
  ]
  for (const [path, moduleValue] of entries) {
    await touch(projectRoot, path)
    modules.set(path, moduleValue)
  }
  return { projectRoot, modules }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

describe('Holo Panels discovery compiler', () => {
  it('provides precise guards for every discoverable definition kind', () => {
    const values = [
      definition({ kind: 'panel', id: 'panel' }),
      definition({ kind: 'resource', id: 'resource' }),
      definition({ kind: 'page', id: 'page' }),
      definition({ kind: 'widget', id: 'widget' }),
      definition({ kind: 'cluster', id: 'cluster' }),
      definition({ kind: 'relation-manager', id: 'relation-manager' }),
      definition({ kind: 'plugin', id: 'plugin' }),
      definition({ kind: 'import', id: 'import' }),
      definition({ kind: 'export', id: 'export' }),
    ]

    expect([
      isPanelDefinition(values[0]),
      isResourceDefinition(values[1]),
      isPageDefinition(values[2]),
      isWidgetDefinition(values[3]),
      isClusterDefinition(values[4]),
      isRelationManagerDefinition(values[5]),
      isPluginDefinition(values[6]),
      isImportDefinition(values[7]),
      isExportDefinition(values[8]),
    ]).toEqual([true, true, true, true, true, true, true, true, true])
  })

  it('discovers all conventional and nested definitions with deterministic metadata', async () => {
    const { projectRoot, modules } = await basicProject()
    const compiler = new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) })

    const result = await compiler.compile()

    expect(result.definitions.map(item => [item.projectPath, item.exportName, item.kind, item.panelId, item.id])).toEqual([
      ['server/admin/AdminPanel.ts', 'default', 'panel', 'admin', 'admin'],
      ['server/admin/clusters/Settings.ts', 'default', 'cluster', 'admin', 'settings'],
      ['server/admin/pages/Dashboard.mjs', 'default', 'page', 'admin', 'dashboard'],
      ['server/admin/resources/posts/PostResource.mts', 'default', 'resource', 'admin', 'posts'],
      ['server/admin/resources/posts/pages/ListPosts.ts', 'ListPosts', 'page', 'admin', 'posts.list'],
      ['server/admin/resources/posts/relation-managers/CommentsRelationManager.cts', 'default', 'relation-manager', 'admin', 'posts.comments'],
      ['server/admin/resources/posts/widgets/PostStats.js', 'default', 'widget', 'admin', 'post-stats'],
      ['server/admin/widgets/AccountStats.cjs', 'default', 'widget', 'admin', 'account-stats'],
    ])
    expect(result.resourceTypeBindings).toEqual([{
      exportName: 'default',
      modelName: 'Post',
      projectPath: 'server/admin/resources/posts/PostResource.mts',
      tableName: 'posts',
    }])
    expect(result.relationManagerTypeBindings).toEqual([{
      exportName: 'default',
      ownerResourceExportName: 'default',
      ownerResourceProjectPath: 'server/admin/resources/posts/PostResource.mts',
      projectPath: 'server/admin/resources/posts/relation-managers/CommentsRelationManager.cts',
      relationship: 'comments',
    }])
    expect(result.artifacts.map(artifact => artifact.path)).toEqual(PANEL_ARTIFACT_NAMES)
    expect(result.artifacts.find(artifact => artifact.path === 'server-registry.ts')?.contents).toContain("async () => (await import(\"../../../server/admin/AdminPanel\"))[\"default\"]")
    expect(result.artifacts.find(artifact => artifact.path === 'client-manifest.ts')?.contents).not.toContain('projectPath')
    expect(result.artifacts.find(artifact => artifact.path === 'types.d.ts')?.contents).toContain('"admin:posts": true')
    expect(JSON.parse(result.artifacts.find(artifact => artifact.path === 'panel-routes.json')!.contents)).toEqual({
      routes: [{ domain: null, method: 'GET', panelId: 'admin', scope: 'public', source: '/admin/health' }],
      version: 1,
    })
  })

  it('includes explicit panel registrations in generated artifacts', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    const resource = definition({
      client: { slug: 'posts' },
      id: 'posts',
      kind: 'resource',
      server: { resolve: () => 'server-only' },
    })
    const panel = definition({
      client: { label: 'Admin' },
      id: 'admin',
      kind: 'panel',
      server: { registered: [{ definition: resource, value: resource }] },
    })
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: panel }],
    ])

    const result = await new DiscoveryCompiler({
      projectRoot,
      loadModule: moduleLoader(projectRoot, modules),
    }).compile()

    expect(result.definitions.map(item => [item.kind, item.id, item.exportName])).toEqual([
      ['panel', 'admin', 'default'],
      ['resource', 'posts', 'default.resource.posts'],
    ])
    expect(result.artifacts.find(artifact => artifact.path === 'resources.ts')?.contents).toContain('"id": "posts"')
    expect(result.artifacts.find(artifact => artifact.path === 'server-registry.ts')?.contents).toContain('definition.server.registered[0].value')
    expect(result.artifacts.find(artifact => artifact.path === 'client-manifest.ts')?.contents).not.toContain('server-only')
  })

  it('generates complete resource CRUD pages from registered resource pages', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/resources/posts/PostResource.ts')
    const resource = {
      ...definition({ id: 'posts', kind: 'resource' }),
      capabilities: { delete: true, forceDelete: false, restore: false },
      form: { dependencies: [], fields: [{ disabled: false, label: 'Title', path: 'title', properties: {}, readOnly: false, required: true, type: 'text', visible: true }] },
      navigation: { icon: 'document-text', label: 'Posts', sort: 10 },
      recordTitle: 'title',
      routeKey: 'id',
      pages: [
        { pageType: 'list', path: '/' },
        { pageType: 'create', path: '/create' },
        { pageType: 'view', path: '/{record}' },
        { pageType: 'edit', path: '/{record}/edit' },
      ],
      singular: null,
      slug: 'posts',
      table: { columns: [{ alignment: 'start', copyable: false, hidden: false, inlineEditor: null, label: 'Title', path: 'title', sortable: true, toggleable: true, type: 'text', width: null, wrap: true }] },
    }
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ client: { path: '/admin' }, id: 'admin', kind: 'panel', route: '/admin' }) }],
      ['server/admin/resources/posts/PostResource.ts', { default: resource }],
    ])

    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()
    const pages = result.definitions.filter(item => item.kind === 'page')

    expect(pages.map(item => [item.id, item.route])).toEqual([
      ['posts-create', '/admin/posts/create'],
      ['posts-edit', '/admin/posts/:record/edit'],
      ['posts', '/admin/posts'],
      ['posts-view', '/admin/posts/:record'],
    ])
    expect(pages.map(item => Reflect.get(Reflect.get(item.client, 'body') as object, 'component'))).toEqual(['resource-page', 'resource-page', 'resource-page', 'resource-page'])
    expect(result.artifacts.find(artifact => artifact.path === 'server-registry.ts')?.contents).toContain('createGeneratedResourcePage')
  })

  it('supports configured panel entries and panel-relative directories', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'features/control/Control.ts')
    await touch(projectRoot, 'features/control/catalog/Products.ts')
    const modules = new Map<string, DiscoveryModule>([
      ['features/control/Control.ts', { default: definition({
        kind: 'panel',
        id: 'control',
        discover: { resources: 'catalog' },
      }) }],
      ['features/control/catalog/Products.ts', { default: definition({ kind: 'resource', id: 'products' }) }],
    ])
    const compiler = new DiscoveryCompiler({
      projectRoot,
      panelEntries: ['features/control/Control.ts'],
      loadModule: moduleLoader(projectRoot, modules),
    })

    expect((await compiler.compile()).definitions.map(item => item.id)).toEqual(['control', 'products'])
  })

  it('rejects relation managers that are not registered by their parent resource', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/resources/posts/PostResource.ts')
    await touch(projectRoot, 'server/admin/resources/posts/relation-managers/CommentsRelationManager.ts')
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ id: 'admin', kind: 'panel' }) }],
      ['server/admin/resources/posts/PostResource.ts', { default: {
        ...definition({ id: 'posts', kind: 'resource' }),
        model: { definition: { name: 'Post', table: { tableName: 'posts' } } },
        relations: [],
      } }],
      ['server/admin/resources/posts/relation-managers/CommentsRelationManager.ts', { default: {
        ...definition({ id: 'comments', kind: 'relation-manager' }),
        relationName: 'comments',
      } }],
    ])

    await expect(new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile())
      .rejects.toMatchObject({ code: 'PANELS_DISCOVERY_RELATION_OWNER_MISSING' })
  })

  it('loads root configuration and scopes ordered defaults to discovered panel definitions', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'panels.config.ts')
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/pages/Dashboard.ts')
    const application = componentDefault('column', 'text', builder => builder)
    const plugin = componentDefault('column', 'text', builder => builder)
    const panel = componentDefault('column', 'text', builder => builder)
    const modules = new Map<string, DiscoveryModule>([
      ['panels.config.ts', { default: definePanelsConfig({ defaults: [application] }) }],
      ['server/admin/AdminPanel.ts', { default: definition({
        kind: 'panel',
        id: 'admin',
        server: {
          defaults: [panel],
          plugins: [{ contributions: [{ default: plugin, kind: 'default' }] }],
        },
      }) }],
      ['server/admin/pages/Dashboard.ts', { default: definition({ kind: 'page', id: 'dashboard' }) }],
    ])
    const contexts = new Map<string, DiscoveryModuleLoadContext | undefined>()
    const loadModule = (absolutePath: string, context?: DiscoveryModuleLoadContext): DiscoveryModule => {
      const projectPath = relative(projectRoot, absolutePath).replaceAll('\\', '/')
      contexts.set(projectPath, context)
      return modules.get(projectPath) ?? {}
    }

    await new DiscoveryCompiler({ projectRoot, loadModule }).compile()

    expect(contexts.get('server/admin/AdminPanel.ts')?.componentDefaults).toEqual({ application: [application] })
    expect(contexts.get('server/admin/pages/Dashboard.ts')?.componentDefaults).toEqual({
      application: [application],
      panel: [panel],
      plugins: [[plugin]],
    })
  })

  it('prefers a marked default export and accepts one marked named export', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/pages/Named.ts')
    const preferred = definition({ kind: 'panel', id: 'admin' })
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', {
        default: preferred,
        ignoredNamedMarker: definition({ kind: 'panel', id: 'ignored' }),
      }],
      ['server/admin/pages/Named.ts', {
        helper: 'not a definition',
        namedPage: definition({ kind: 'page', id: 'named', route: '/named' }),
      }],
    ])

    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()

    expect(result.definitions.map(item => [item.id, item.exportName])).toEqual([
      ['admin', 'default'],
      ['named', 'namedPage'],
    ])
  })

  it('ignores declarations, tests, dot directories, build output, and modules without markers', async () => {
    const projectRoot = await createProject()
    const paths = [
      'server/admin/AdminPanel.ts',
      'server/admin/pages/NoDefinition.ts',
      'server/admin/pages/Ignored.test.ts',
      'server/admin/pages/Ignored.spec.js',
      'server/admin/pages/Types.d.ts',
      'server/admin/pages/.private/Secret.ts',
      'server/admin/pages/dist/Compiled.js',
    ]
    await Promise.all(paths.map(path => touch(projectRoot, path)))
    const loadedPaths: string[] = []
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin' }) }],
      ['server/admin/pages/NoDefinition.ts', { helper: true }],
    ])

    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules, loadedPaths) }).compile()

    expect(result.definitions.map(item => item.id)).toEqual(['admin'])
    expect(loadedPaths).toEqual(['server/admin/AdminPanel.ts', 'server/admin/pages/NoDefinition.ts'])
  })

  it('invalidates only changed modules and removes deleted and renamed entries', async () => {
    const { projectRoot, modules } = await basicProject()
    const loadedPaths: string[] = []
    const compiler = new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules, loadedPaths) })
    await compiler.compile()
    loadedPaths.splice(0)
    modules.set('server/admin/widgets/AccountStats.cjs', { default: definition({ kind: 'widget', id: 'account-stats', client: { label: 'Changed' } }) })

    const changed = await compiler.compile([{ kind: 'changed', path: 'server/admin/widgets/AccountStats.cjs' }])

    expect(loadedPaths).toEqual(['server/admin/widgets/AccountStats.cjs'])
    expect(changed.invalidatedPaths).toEqual(['server/admin/widgets/AccountStats.cjs'])
    expect(changed.changedArtifacts.map(item => item.path)).toEqual(expect.arrayContaining(['client-manifest.ts', 'widgets.ts', 'registry.json']))
    loadedPaths.splice(0)
    await rm(join(projectRoot, 'server/admin/widgets/AccountStats.cjs'))
    modules.delete('server/admin/widgets/AccountStats.cjs')
    await touch(projectRoot, 'server/admin/widgets/RenamedStats.ts')
    modules.set('server/admin/widgets/RenamedStats.ts', { default: definition({ kind: 'widget', id: 'renamed-stats' }) })

    const renamed = await compiler.compile([
      { kind: 'deleted', path: 'server/admin/widgets/AccountStats.cjs' },
      { kind: 'created', path: 'server/admin/widgets/RenamedStats.ts' },
    ])

    expect(loadedPaths).toEqual(['server/admin/widgets/RenamedStats.ts'])
    expect(renamed.definitions.some(item => item.id === 'account-stats')).toBe(false)
    expect(renamed.definitions.some(item => item.id === 'renamed-stats')).toBe(true)
  })

  it('updates generated relation-manager bindings for dev create and delete events', async () => {
    const { projectRoot, modules } = await basicProject()
    const compiler = new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) })
    const relationPath = 'server/admin/resources/posts/relation-managers/CommentsRelationManager.cts'

    expect((await compiler.compile()).relationManagerTypeBindings).toHaveLength(1)
    await rm(join(projectRoot, relationPath))
    modules.delete(relationPath)

    const deleted = await compiler.compile([{ kind: 'deleted', path: relationPath }])
    expect(deleted.relationManagerTypeBindings).toEqual([])

    await touch(projectRoot, relationPath)
    modules.set(relationPath, { default: {
      ...definition({ id: 'posts.comments', kind: 'relation-manager' }),
      relationName: 'comments',
    } })
    const created = await compiler.compile([{ kind: 'created', path: relationPath }])
    expect(created.relationManagerTypeBindings).toHaveLength(1)
  })

  it('prepares shared registered action permission references without weakening duplicate declarations', async () => {
    const projectRoot = await createProject()
    const action = defineAction('publish').authorize(() => true).action(() => null)
    const registration = { compile: () => action.compile(), id: 'publish', resourceRecordType: {} }
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin' }) }],
      ['server/admin/widgets/First.ts', { default: defineStatsWidget('first').actions([registration]).data(() => ({ stats: [] })) }],
      ['server/admin/widgets/Second.ts', { default: defineStatsWidget('second').actions([registration]).data(() => ({ stats: [] })) }],
      ['server/admin/resources/posts/PostResource.ts', { default: definition({ kind: 'resource', id: 'posts', permissionReferences: ['actions.publish.view', 'widgets.first.view'] }) }],
    ])
    for (const path of modules.keys()) await touch(projectRoot, path)
    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()
    expect(result.definitions.filter(item => item.permissionKeys.includes('actions.publish.view'))).toHaveLength(3)
    expect(result.definitions.find(item => item.id === 'posts')?.permissionKeys).toEqual(['actions.publish.view', 'widgets.first.view'])
  })

  it.each([
    ['id', definition({ kind: 'page', id: 'duplicate', route: '/one' }), definition({ kind: 'page', id: 'duplicate', route: '/two' })],
    ['route', definition({ kind: 'page', id: 'one', route: '/same' }), definition({ kind: 'page', id: 'two', route: '/same' })],
    ['permission', definition({ kind: 'page', id: 'one', permissionKeys: ['same'] }), definition({ kind: 'page', id: 'two', permissionKeys: ['same'] })],
    ['owned permission with references', definition({ kind: 'page', id: 'one', permissionKeys: ['same'], permissionReferences: ['same'] }), definition({ kind: 'page', id: 'two', permissionKeys: ['same'], permissionReferences: ['same'] })],
    ['component-key', definition({ kind: 'page', id: 'one', componentKeys: ['same'] }), definition({ kind: 'page', id: 'two', componentKeys: ['same'] })],
    ['navigation-key', definition({ kind: 'page', id: 'one', navigationKeys: ['same'] }), definition({ kind: 'page', id: 'two', navigationKeys: ['same'] })],
  ])('reports source-located duplicate %s errors', async (_kind, first, second) => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/pages/First.ts')
    await touch(projectRoot, 'server/admin/pages/Second.ts')
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin' }) }],
      ['server/admin/pages/First.ts', { default: first }],
      ['server/admin/pages/Second.ts', { default: second }],
    ])

    await expect(new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile())
      .rejects.toThrow('server/admin/pages/Second.ts#default')
  })

  it('allows a panel landing page to use the panel root route', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/pages/Dashboard.ts')
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin', route: '/admin' }) }],
      ['server/admin/pages/Dashboard.ts', { default: definition({ kind: 'page', id: 'dashboard', route: '/admin' }) }],
    ])

    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()

    expect(result.definitions.map(item => [item.kind, item.route])).toEqual([
      ['panel', '/admin'],
      ['page', '/admin'],
    ])
  })

  it('rejects multiple defaults, ambiguous named exports, mismatched panels, and unsafe client state', async () => {
    const projectRoot = await createProject()
    await touch(projectRoot, 'server/admin/AdminPanel.ts')
    await touch(projectRoot, 'server/admin/pages/Bad.ts')
    const modules = new Map<string, DiscoveryModule>([
      ['server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin' }) }],
      ['server/admin/pages/Bad.ts', {
        one: definition({ kind: 'page', id: 'one' }),
        two: definition({ kind: 'page', id: 'two' }),
      }],
    ])
    const compile = (): Promise<unknown> => new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()
    await expect(compile()).rejects.toThrow('multiple marked named exports')

    modules.set('server/admin/pages/Bad.ts', { default: definition({ kind: 'page', id: 'bad', panelId: 'other' }) })
    await expect(compile()).rejects.toThrow('declares panel other')

    modules.set('server/admin/pages/Bad.ts', {
      default: {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'page',
        id: 'bad',
        client: { handler: () => undefined },
      },
    })
    await expect(compile()).rejects.toThrow('not JSON-safe')

    modules.set('server/admin/pages/Bad.ts', { default: definition({ kind: 'page', id: 'bad' }) })
    modules.set('server/admin/AdminPanel.ts', { default: definition({ kind: 'panel', id: 'admin', default: true }) })
    await touch(projectRoot, 'server/vendor/VendorPanel.ts')
    modules.set('server/vendor/VendorPanel.ts', { default: definition({ kind: 'panel', id: 'vendor', default: true }) })
    await expect(compile()).rejects.toThrow('Duplicate default-panel')
  })

  it('loads the generated registry without source directories at production runtime', async () => {
    const { projectRoot, modules } = await basicProject()
    const result = await new DiscoveryCompiler({ projectRoot, loadModule: moduleLoader(projectRoot, modules) }).compile()
    const generatedRoot = join(projectRoot, '.holo-js/generated/panels')
    await mkdir(generatedRoot, { recursive: true })
    await Promise.all(result.artifacts.map(artifact => writeFile(join(generatedRoot, artifact.path), artifact.contents)))
    await rm(join(projectRoot, 'server'), { recursive: true, force: true })

    const registry = await loadGeneratedPanelsRegistry(projectRoot)

    expect(registry.definitions).toHaveLength(8)
    expect(await readFile(join(generatedRoot, 'registry.json'), 'utf8')).toContain('server/admin/AdminPanel.ts')
  })

  it('rejects project paths that escape the project root', async () => {
    const projectRoot = await createProject()
    const compiler = new DiscoveryCompiler({
      projectRoot,
      panelEntries: ['../OutsidePanel.ts'],
      loadModule: () => ({}),
    })

    await expect(compiler.compile()).rejects.toBeInstanceOf(PanelsDiscoveryError)
  })
})
