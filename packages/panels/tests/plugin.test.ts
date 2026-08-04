import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
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
): HoloProjectPrepareContext {
  return {
    projectRoot,
    generatedRoot: join(projectRoot, '.holo-js/generated'),
    pluginGeneratedRoot: join(projectRoot, '.holo-js/generated/panels'),
    config: normalizeHoloProjectConfig(),
    plugin: {
      id: 'panels',
      name: 'Holo Panels',
      packageName: '@holo-js/panels',
      packageRoot: '/project/node_modules/@holo-js/panels',
    },
    run: {
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
      'registry.json',
    ])
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'registry.json')?.contents)
      .toBe('{\n  "version": 1,\n  "definitions": []\n}\n')
    expect(result.watch).toEqual({ roots: ['server'] })
    expect(Object.hasOwn(result, 'managedArtifacts')).toBe(false)
  })

  it('discovers project definitions and plans managed framework artifacts', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'holo-panels-prepare-'))
    temporaryDirectories.push(projectRoot)
    await mkdir(join(projectRoot, 'server/admin'), { recursive: true })
    await writeFile(join(projectRoot, 'server/admin/AdminPanel.ts'), `
      export default {
        discoveryMarker: '@holo-js/panels/discovery/v1',
        kind: 'panel',
        id: 'admin',
        route: '/admin',
        client: { path: '/admin' },
      } as const
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
      'app/_holo/panels/[panelId]/[operation]/route.ts',
      'app/admin/[[...panelsPath]]/page.tsx',
      'app/admin/[[...panelsPath]]/panels-client.tsx',
    ])
    expect(result.generatedArtifacts?.map(artifact => artifact.path)).toEqual(expect.arrayContaining(['plugin-renderers.ts', 'plugins.json']))
    expect(result.generatedArtifacts?.find(artifact => artifact.path === 'framework-artifacts.json')?.contents)
      .toContain('"checksum"')
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
