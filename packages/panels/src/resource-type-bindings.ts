import { readFile } from 'node:fs/promises'
import { extname, posix, resolve } from 'node:path'
import type {
  DiscoveredRelationManagerTypeBinding,
  DiscoveredResourceTypeBinding,
  GeneratedPanelArtifact,
} from '@holo-js/panels-cli'

interface GeneratedModelRegistryEntry {
  readonly exportName?: string
  readonly name: string
  readonly sourcePath: string
  readonly tableName: string
}

interface GeneratedProjectRegistry {
  readonly models: readonly GeneratedModelRegistryEntry[]
  readonly version: number
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseProjectRegistry(contents: string): GeneratedProjectRegistry {
  const value = JSON.parse(contents) as unknown
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.models)) {
    throw new Error('[Holo Panels] Invalid Holo generated project registry. Run holo prepare.')
  }

  const models = value.models.map((model): GeneratedModelRegistryEntry => {
    if (!isRecord(model)
      || typeof model.name !== 'string'
      || typeof model.sourcePath !== 'string'
      || typeof model.tableName !== 'string'
      || (model.exportName !== undefined && typeof model.exportName !== 'string')) {
      throw new Error('[Holo Panels] Invalid Holo generated model registry entry. Run holo prepare.')
    }
    return {
      ...(model.exportName ? { exportName: model.exportName } : {}),
      name: model.name,
      sourcePath: model.sourcePath,
      tableName: model.tableName,
    }
  })

  return { models, version: 1 }
}

function modulePath(projectPath: string): string {
  const extension = extname(projectPath)
  const withoutExtension = extension ? projectPath.slice(0, -extension.length) : projectPath
  return posix.join('../../..', withoutExtension)
}

function exportedType(projectPath: string, exportName: string): string {
  const imported = `typeof import(${JSON.stringify(modulePath(projectPath))})`
  return exportName === 'default' ? `${imported}.default` : `${imported}[${JSON.stringify(exportName)}]`
}

function resourceKey(binding: DiscoveredResourceTypeBinding): string {
  return `${binding.projectPath}#${binding.exportName}`
}

function relationManagerKey(binding: DiscoveredRelationManagerTypeBinding): string {
  return `${binding.projectPath}#${binding.exportName}`
}

function renderResourceEntries(
  bindings: readonly DiscoveredResourceTypeBinding[],
  models: ReadonlyMap<string, GeneratedModelRegistryEntry>,
): readonly string[] {
  return bindings.map((binding) => {
    const model = models.get(`${binding.modelName}\0${binding.tableName}`)
    if (!model) {
      throw new Error(`[Holo Panels] Resource ${binding.projectPath} uses model ${binding.modelName}, but Holo did not generate that model.`)
    }
    return [
      `    readonly ${JSON.stringify(resourceKey(binding))}: {`,
      `      readonly model: ${exportedType(model.sourcePath, model.exportName ?? 'default')}`,
      `      readonly resource: ${exportedType(binding.projectPath, binding.exportName)}`,
      '    }',
    ].join('\n')
  })
}

function renderRelationManagerEntries(
  bindings: readonly DiscoveredRelationManagerTypeBinding[],
  resources: ReadonlyMap<string, DiscoveredResourceTypeBinding>,
  models: ReadonlyMap<string, GeneratedModelRegistryEntry>,
): readonly string[] {
  return bindings.map((binding) => {
    const resource = resources.get(`${binding.ownerResourceProjectPath}#${binding.ownerResourceExportName}`)
    if (!resource) throw new Error(`[Holo Panels] Relation manager ${binding.projectPath} has no registered parent resource.`)
    const model = models.get(`${resource.modelName}\0${resource.tableName}`)
    if (!model) throw new Error(`[Holo Panels] Parent resource ${resource.projectPath} has no generated Holo model.`)
    return [
      `    readonly ${JSON.stringify(relationManagerKey(binding))}: {`,
      `      readonly manager: ${exportedType(binding.projectPath, binding.exportName)}`,
      `      readonly ownerModel: ${exportedType(model.sourcePath, model.exportName ?? 'default')}`,
      `      readonly relationship: ${JSON.stringify(binding.relationship)}`,
      '    }',
    ].join('\n')
  })
}

export async function renderResourceTypeBindings(
  projectRoot: string,
  resourceBindings: readonly DiscoveredResourceTypeBinding[],
  relationManagerBindings: readonly DiscoveredRelationManagerTypeBinding[],
): Promise<GeneratedPanelArtifact> {
  let registryContents: string
  try {
    registryContents = await readFile(resolve(projectRoot, '.holo-js/generated/registry.json'), 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT' && resourceBindings.length === 0) {
      registryContents = '{"version":1,"models":[]}'
    } else {
      throw error
    }
  }
  const registry = parseProjectRegistry(registryContents)
  const models = new Map(registry.models.map(model => [`${model.name}\0${model.tableName}`, model]))
  const resources = new Map(resourceBindings.map(binding => [resourceKey(binding), binding]))
  const resourceEntries = renderResourceEntries(resourceBindings, models)
  const relationManagerEntries = renderRelationManagerEntries(relationManagerBindings, resources, models)
  const resourceRegistry = resourceEntries.length > 0
    ? ['  interface ResourceTypeRegistry {', ...resourceEntries, '  }']
    : []
  const relationManagerRegistry = relationManagerEntries.length > 0
    ? ['  interface RelationManagerTypeRegistry {', ...relationManagerEntries, '  }']
    : []

  return {
    path: 'resource-type-bindings.d.ts',
    contents: [
      '// Generated by holo prepare. Do not edit.',
      '',
      ...(resourceRegistry.length > 0 || relationManagerRegistry.length > 0
        ? [
            'declare module \'@holo-js/panels-resources\' {',
            ...resourceRegistry,
            ...relationManagerRegistry,
            '}',
            '',
          ]
        : []),
      'export {}',
      '',
    ].join('\n'),
  }
}
