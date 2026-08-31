import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeHoloProjectConfig, type HoloProjectPrepareContext } from '@holo-js/kernel'
import { afterEach, describe, expect, it, vi } from 'vitest'
import migrations from '../src/migrations'
import plugin from '../src/plugin'
import preparer from '../src/prepare'
import bootHoloPanels from '../src/runtime'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })))
})

function createPrepareContext(
  signal = new AbortController().signal,
  projectRoot = '/project',
  framework = false,
  overrides: Partial<Pick<HoloProjectPrepareContext, 'config' | 'run'>> = {},
): HoloProjectPrepareContext {
  return {
    projectRoot,
    generatedRoot: join(projectRoot, '.holo-js/generated'),
    pluginGeneratedRoot: join(projectRoot, '.holo-js/generated/panels'),
    config: overrides.config ?? normalizeHoloProjectConfig(),
    plugin: {
      id: 'panels',
      name: 'Holo Panels',
      packageName: '@holo-js/panels',
      packageRoot: '/project/node_modules/@holo-js/panels',
    },
    run: overrides.run ?? {
      kind: 'full',
      command: 'prepare',
      reason: 'explicit',
    },
    signal,
    ...(framework ? {
      framework: {
        id: 'next',
        displayName: 'Next.js',
        adapterPackage: '@holo-js/adapter-next',
        capabilities: { managedBroadcastAuthRoute: false },
      },
    } : {}),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
    },
  }
}

describe('Holo Panels plugin', () => {
  it('contributes package-owned modules through the Holo plugin contract', () => {
    expect(plugin).toEqual({
      id: 'panels',
      name: 'Holo Panels',
      description: 'Official resource-driven panel system for Holo-JS',
      contributes: {
        dependencies: { holo: ['@holo-js/security'] },
        cli: { commands: './dist/commands.mjs' },
        runtime: { boot: './dist/runtime.mjs' },
        migrations: { publish: './dist/migrations.mjs' },
        project: { prepare: './dist/prepare.mjs' },
      },
    })
  })

  it('prepares the deterministic empty artifact tree and watches panel source', async () => {
    const result = await preparer.prepare(createPrepareContext())

    expect(result.kind).toBe('prepared')
    expect(result.generatedArtifacts?.map(artifact => artifact.path)).toEqual([
      'panels.ts',
      'server-registry.ts',
      'client-manifest.ts',
      'client-components.ts',
      'resources.ts',
      'pages.ts',
      'widgets.ts',
      'clusters.ts',
      'navigation.ts',
      'permissions.ts',
      'types.d.ts',
      'framework-artifacts.json',
      'panel-routes.json',
      'registry.json',
      'resource-type-bindings.d.ts',
      'resource-type-checks.ts',
      'theme.css',
    ])
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'registry.json')?.contents)
      .toBe('{\n  "version": 1,\n  "definitions": []\n}\n')
    expect(result.watch).toEqual({ roots: ['server', 'resources'] })
    expect(Object.hasOwn(result, 'managedArtifacts')).toBe(false)
  })

  it('discovers project definitions and plans managed framework artifacts', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-prepare-'))
    temporaryDirectories.push(projectRoot)
    await mkdir(join(projectRoot, 'server/admin'), { recursive: true })
    await mkdir(join(projectRoot, 'resources/panels/renderers'), { recursive: true })
    await writeFile(join(projectRoot, 'server/admin/AdminPanel.ts'), `
      export default {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'panel',
        id: 'admin',
        route: '/admin',
        client: { path: '/admin' },
      } as const
    `)
    await writeFile(join(projectRoot, 'resources/panels/renderers/react.ts'), `
      export default function register(registry) { return registry }
    `)

    const result = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      true,
    ))

    expect(result.kind).toBe('prepared')
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'registry.json')?.contents)
      .toContain('server/admin/AdminPanel.ts')
    expect(result.managedArtifacts?.map(artifact => artifact.path)).toEqual([
      'app/admin/[[...panelsPath]]/page.tsx',
      'app/admin/[[...panelsPath]]/panels-client.tsx',
      'app/holo/panels/[panelId]/[operation]/route.ts',
      'app/holo/panels/[panelId]/auth/[operation]/route.ts',
      'app/holo/panels/[panelId]/tenant/[operation]/route.ts',
    ])
    expect(result.generatedArtifacts?.map(artifact => artifact.path)).toEqual(expect.arrayContaining(['application-renderers.ts', 'plugin-renderers.ts', 'plugins.json']))
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'application-renderers.ts')?.contents)
      .toContain("../../../resources/panels/renderers/react")
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'framework-artifacts.json')?.contents)
      .toContain('"checksum"')
  })

  it('updates Custom widget renderer registrations on development add and delete', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-widget-watch-'))
    temporaryDirectories.push(projectRoot)
    const directory = join(projectRoot, 'resources/panels/renderers/next/widgets')
    await mkdir(directory, { recursive: true })
    const path = join(directory, 'admin-notice.tsx')
    const context = createPrepareContext(new AbortController().signal, projectRoot, true)
    await writeFile(path, 'export default function Notice() { return null }\n')
    const added = await preparer.prepare(context)
    expect(added.watch?.roots).toEqual(['server', 'resources'])
    expect(added.generatedArtifacts?.find(artifact => artifact.path === 'application-renderers.ts')?.contents).toContain("registry.register('widget.app.widgets.admin-notice'")
    await rm(path)
    const removed = await preparer.prepare({ ...context, run: { command: 'dev', kind: 'incremental', changes: [{ kind: 'deleted', path: 'resources/panels/renderers/next/widgets/admin-notice.tsx' }] } })
    expect(removed.generatedArtifacts?.find(artifact => artifact.path === 'application-renderers.ts')?.contents).not.toContain('admin-notice')
  })

  it('rebuilds relation bindings when custom model and migration paths change during development', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-relation-watch-'))
    temporaryDirectories.push(projectRoot)
    const modelPath = 'domain/models/Post.ts'
    const migrationPath = 'database/changes/2026_08_26_000001_posts.ts'
    const resourcePath = 'server/admin/resources/posts/PostResource.ts'
    const managerPath = 'server/admin/resources/posts/relation-managers/PostRelationManager.ts'
    const resourceSource = `import Post, { relationship } from '../../../../domain/models/Post'\n\nexport default {\n  discoveryMarker: '@holo-js/panels/discovery/v1',\n  id: 'posts',\n  kind: 'resource',\n  model: Post,\n  relations: [{ relationship }],\n}\n`
    const managerSource = `import { relationship } from '../../../../../domain/models/Post'\n\nexport default {\n  discoveryMarker: '@holo-js/panels/discovery/v1',\n  id: 'posts.relation',\n  kind: 'relation-manager',\n  relationName: relationship,\n}\n`
    await Promise.all([
      mkdir(join(projectRoot, '.holo-js/generated'), { recursive: true }),
      mkdir(join(projectRoot, 'domain/models'), { recursive: true }),
      mkdir(join(projectRoot, 'database/changes'), { recursive: true }),
      mkdir(join(projectRoot, 'server/admin/resources/posts/relation-managers'), { recursive: true }),
    ])
    const modelSource = (relationship: string): string => `export const relationship = '${relationship}'\n\nexport default {\n  create() { return {} },\n  definition: { name: 'Post', primaryKey: 'id', relations: {}, softDeletes: false, table: { tableName: 'posts' } },\n  query() { return {} },\n}\n`
    await Promise.all([
      writeFile(join(projectRoot, '.holo-js/generated/registry.json'), `${JSON.stringify({
        models: [{ exportName: 'default', name: 'Post', sourcePath: modelPath, tableName: 'posts' }],
        version: 1,
      })}\n`),
      writeFile(join(projectRoot, modelPath), modelSource('comments')),
      writeFile(join(projectRoot, migrationPath), 'export default {}\n'),
      writeFile(join(projectRoot, 'server/admin/AdminPanel.ts'), `export default {\n  client: { path: '/admin' },\n  discoveryMarker: '@holo-js/panels/discovery/v1',\n  id: 'admin',\n  kind: 'panel',\n  route: '/admin',\n}\n`),
      writeFile(join(projectRoot, resourcePath), resourceSource),
      writeFile(join(projectRoot, managerPath), managerSource),
    ])
    const config = normalizeHoloProjectConfig({
      migrations: [migrationPath],
      models: [modelPath],
    })
    const prepared = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      { config },
    ))

    expect(prepared.watch?.roots).toEqual(['server', 'resources', 'domain/models', 'database/changes'])
    expect(prepared.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')?.contents)
      .toContain('readonly relationship: "comments"')

    await writeFile(join(projectRoot, modelPath), modelSource('tags'))
    const modelChanged = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      {
        config,
        run: { command: 'dev', kind: 'incremental', changes: [{ kind: 'changed', path: modelPath }] },
      },
    ))

    expect(modelChanged.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')?.contents)
      .toContain('readonly relationship: "tags"')

    const migrationChanged = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      {
        config,
        run: { command: 'dev', kind: 'incremental', changes: [{ kind: 'changed', path: migrationPath }] },
      },
    ))

    expect(migrationChanged.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')?.contents)
      .toContain('readonly relationship: "tags"')

    await rm(join(projectRoot, managerPath))
    const managerDeleted = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      {
        config,
        run: { command: 'dev', kind: 'incremental', changes: [{ kind: 'deleted', path: managerPath }] },
      },
    ))

    expect(managerDeleted.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')?.contents)
      .not.toContain('PostRelationManager')
    expect(managerDeleted.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-checks.ts')?.contents)
      .not.toContain('RelationManagerRelationship')
    expect(await readFile(join(projectRoot, resourcePath), 'utf8')).toBe(resourceSource)
    expect(await readFile(join(projectRoot, modelPath), 'utf8')).toBe(modelSource('tags'))

    const addedManagerPath = 'server/admin/resources/posts/relation-managers/AddedRelationManager.ts'
    await writeFile(join(projectRoot, addedManagerPath), managerSource)
    const managerAdded = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      {
        config,
        run: { command: 'dev', kind: 'incremental', changes: [{ kind: 'created', path: addedManagerPath }] },
      },
    ))

    expect(managerAdded.generatedArtifacts?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')?.contents)
      .toContain('AddedRelationManager')

    const renamedManagerPath = 'server/admin/resources/posts/relation-managers/RenamedRelationManager.ts'
    await rename(join(projectRoot, addedManagerPath), join(projectRoot, renamedManagerPath))
    const managerRenamed = await preparer.prepare(createPrepareContext(
      new AbortController().signal,
      projectRoot,
      false,
      {
        config,
        run: {
          command: 'dev',
          kind: 'incremental',
          changes: [
            { kind: 'deleted', path: addedManagerPath },
            { kind: 'created', path: renamedManagerPath },
          ],
        },
      },
    ))
    const renamedBindings = managerRenamed.generatedArtifacts
      ?.find(artifact => artifact.path === 'resource-type-bindings.d.ts')
      ?.contents

    expect(renamedBindings).toContain('RenamedRelationManager')
    expect(renamedBindings).not.toContain('AddedRelationManager')
    expect(await readFile(join(projectRoot, resourcePath), 'utf8')).toBe(resourceSource)
    expect(await readFile(join(projectRoot, modelPath), 'utf8')).toBe(modelSource('tags'))
  })

  it('stops before preparing when the host aborts the run', async () => {
    const controller = new AbortController()
    controller.abort(new Error('cancelled'))

    await expect(preparer.prepare(createPrepareContext(controller.signal))).rejects.toThrow('cancelled')
  })

  it('boots without registering premature runtime behavior', () => {
    expect(bootHoloPanels()).toBeUndefined()
  })

  it('publishes the package-owned transfer persistence migration', () => {
    expect(migrations.map(migration => migration.name)).toEqual(['2026_07_29_000001_create_panel_transfer_tables'])
    expect(Object.isFrozen(migrations)).toBe(true)
  })
})
