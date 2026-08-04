import { mkdtemp, mkdir, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  componentDefault,
  createExtensionTypeId,
  type PanelPluginContributionDefinition,
} from '@holo-js/panels-core'
import { describe, expect, it } from 'vitest'
import { preparePanelPlugins } from '../src/plugin-preparation'

async function fixture(): Promise<{ readonly packageRoot: string, readonly projectRoot: string }> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'panels-plugin-preparation-'))
  const packageRoot = join(projectRoot, 'node_modules/@acme/money')
  await mkdir(packageRoot, { recursive: true })
  await writeFile(join(projectRoot, 'package.json'), JSON.stringify({ name: 'fixture', private: true, type: 'module' }))
  await writeFile(join(packageRoot, 'package.json'), JSON.stringify({
    exports: {
      '.': './index.js',
      './react': './react.js',
      './style.css': './style.css',
    },
    name: '@acme/money',
    type: 'module',
  }))
  await writeFile(join(packageRoot, 'index.js'), 'export const plugin = true\n')
  await writeFile(join(packageRoot, 'react.js'), 'export const CurrencyField = () => null\n')
  await writeFile(join(packageRoot, 'style.css'), '.money { font-variant-numeric: tabular-nums; }\n')
  return { packageRoot, projectRoot }
}

function contributions(): readonly PanelPluginContributionDefinition[] {
  const typeId = createExtensionTypeId('acme.money', 'field', 'currency')
  return [
    { kind: 'extension', registration: { compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, kind: 'field', pluginId: 'acme.money', typeId } },
    { kind: 'renderer', registration: { exportName: 'CurrencyField', framework: 'react', module: './react', typeId } },
    { kind: 'renderer', registration: { exportName: 'CurrencyField', framework: 'vue', module: './react', typeId } },
    { kind: 'renderer', registration: { exportName: 'CurrencyField', framework: 'svelte', module: './react', typeId } },
    { kind: 'asset', registration: { id: 'style', kind: 'style', load: 'eager', source: './style.css' } },
    { kind: 'translation', registration: { catalog: { amount: 'Amount' }, locale: 'en', namespace: 'acme.money' } },
    { kind: 'icon', registration: { definition: { name: 'currency', paths: [{ path: 'M0 0h1v1H0z' }], viewBox: '0 0 1 1' }, id: 'currency' } },
    { default: componentDefault('field', typeId, builder => builder), kind: 'default' },
    { kind: 'permission-subject', subject: { id: 'rates', operations: ['view'], subject: 'page' } },
  ]
}

describe('panel plugin preparation', () => {
  it('resolves public renderer exports and emits fingerprinted safe assets and metadata', async () => {
    const { projectRoot } = await fixture()
    const typeId = createExtensionTypeId('acme.money', 'field', 'currency')
    const result = await preparePanelPlugins({
      framework: 'react',
      plugins: [{ compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'acme.money', packageName: '@acme/money' }],
      projectRoot,
      usedExtensions: [typeId],
    })

    expect(result.rendererModule).toContain("from '@acme/money/react'")
    expect(result.rendererModule).toContain('registerReactExtensionRenderer')
    expect(result.assets).toEqual([
      expect.objectContaining({ id: 'acme.money.style', publicPath: expect.stringMatching(/^\/_holo\/panels\/plugins\/acme\.money\/[a-f0-9]{16}-style\.css$/u) }),
    ])
    expect(result.managedArtifacts[0]?.path).toBe(`public${result.assets[0]?.publicPath}`)
    expect(result.icons[0]?.definition.name).toBe('acme.money.currency')
    expect(result.defaults).toHaveLength(1)
    expect(result.permissions).toEqual([{ id: 'rates', operations: ['view'], subject: 'page' }])
    expect(result.translations[0]?.namespace).toBe('acme.money')

    const repeated = await preparePanelPlugins({
      framework: 'react',
      plugins: [
        { compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'acme.money', packageName: '@acme/money' },
        { compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'acme.money', packageName: '@acme/money' },
      ],
      projectRoot,
      usedExtensions: [typeId],
    })
    expect(repeated.assets).toHaveLength(1)
  })

  it('rejects missing framework renderers, private modules, conflicts, and escaping assets', async () => {
    const { packageRoot, projectRoot } = await fixture()
    const typeId = createExtensionTypeId('acme.money', 'field', 'currency')
    await expect(preparePanelPlugins({
      framework: 'vue',
      plugins: [{
        compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } },
        contributions: contributions().filter(contribution => contribution.kind !== 'renderer' || contribution.registration.framework !== 'vue'),
        id: 'acme.money',
        packageName: '@acme/money',
      }],
      projectRoot,
      usedExtensions: [typeId],
    })).rejects.toThrow('no vue renderer')

    const privateRenderer = contributions().map(contribution => contribution.kind === 'renderer'
      ? { ...contribution, registration: { ...contribution.registration, module: './private' as const } }
      : contribution)
    await expect(preparePanelPlugins({
      framework: 'react',
      plugins: [{ compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: privateRenderer, id: 'acme.money', packageName: '@acme/money' }],
      projectRoot,
      usedExtensions: [typeId],
    })).rejects.toThrow('not a public package export')

    await symlink(join(projectRoot, 'package.json'), join(packageRoot, 'escape.css'))
    const escaping = contributions().map(contribution => contribution.kind === 'asset'
      ? { ...contribution, registration: { ...contribution.registration, source: './escape.css' as const } }
      : contribution)
    await expect(preparePanelPlugins({
      framework: 'react',
      plugins: [{ compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: escaping, id: 'acme.money', packageName: '@acme/money' }],
      projectRoot,
      usedExtensions: [typeId],
    })).rejects.toThrow('remain inside')

    await expect(preparePanelPlugins({
      framework: 'react',
      plugins: [
        { compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'acme.money', packageName: '@acme/money' },
        { compatibility: { panels: { minimum: '0.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'other.money', packageName: '@acme/money' },
      ],
      projectRoot,
      usedExtensions: [typeId],
    })).rejects.toThrow('conflicts between')

    await expect(preparePanelPlugins({
      framework: 'react',
      plugins: [{ compatibility: { panels: { minimum: '99.0.0' }, protocol: { minimum: '1.0' } }, contributions: contributions(), id: 'acme.money', packageName: '@acme/money' }],
      projectRoot,
      usedExtensions: [typeId],
    })).rejects.toThrow('requires Holo Panels panels 99.0.0')
  })
})
