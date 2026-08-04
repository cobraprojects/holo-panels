import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  DiscoveryCompiler,
  PanelsDiscoveryError,
  createProjectDiscoveryModuleLoader,
  planFrameworkArtifacts,
  type FrameworkArtifactManifest,
  type FrameworkId,
} from '@holo-js/panels-cli'
import type {
  ExtensionTypeId,
  PanelPluginContributionDefinition,
  PluginCompatibility,
} from '@holo-js/panels-core'
import {
  defineHoloProjectPreparer,
  HOLO_PROJECT_PREPARE_API_VERSION,
  HoloProjectPrepareError,
} from '@holo-js/kernel'
import { preparePanelPlugins, type PanelPluginPreparationInput } from './plugin-preparation'

const compilers = new Map<string, DiscoveryCompiler>()
const frameworkIds = new Set<string>(['next', 'nuxt', 'sveltekit'])

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseFrameworkOwnership(contents: string | undefined): FrameworkArtifactManifest | undefined {
  if (!contents) return undefined

  let value: unknown
  try {
    value = JSON.parse(contents) as unknown
  } catch {
    throw new Error('[Holo Panels] Framework artifact ownership contains invalid JSON.')
  }

  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.artifacts)) {
    throw new Error('[Holo Panels] Framework artifact ownership has an invalid structure.')
  }

  for (const artifact of value.artifacts) {
    if (!isRecord(artifact)
      || typeof artifact.path !== 'string'
      || !frameworkIds.has(String(artifact.framework))
      || (artifact.kind !== 'panel-page' && artifact.kind !== 'operation-endpoint')
      || typeof artifact.checksum !== 'string'
      || !/^[a-f0-9]{64}$/.test(artifact.checksum)
      || !Array.isArray(artifact.panelIds)
      || !artifact.panelIds.every(panelId => typeof panelId === 'string')) {
      throw new Error('[Holo Panels] Framework artifact ownership has an invalid structure.')
    }
  }

  return value as FrameworkArtifactManifest
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return undefined
    throw error
  }
}

function frameworkId(value: string | undefined): FrameworkId | undefined {
  return value && frameworkIds.has(value) ? value as FrameworkId : undefined
}

function rendererFramework(framework: FrameworkId): 'react' | 'svelte' | 'vue' {
  if (framework === 'next') return 'react'
  if (framework === 'nuxt') return 'vue'
  return 'svelte'
}

function isCompatibility(value: unknown): value is PluginCompatibility {
  if (!isRecord(value) || !isRecord(value.panels) || !isRecord(value.protocol)) return false
  return typeof value.panels.minimum === 'string' && typeof value.protocol.minimum === 'string'
}

function pluginPreparationInputs(server: unknown): readonly PanelPluginPreparationInput[] {
  if (!isRecord(server) || !Array.isArray(server.plugins)) return []
  return server.plugins.map((value) => {
    if (!isRecord(value)
      || typeof value.id !== 'string'
      || typeof value.packageName !== 'string'
      || !isCompatibility(value.compatibility)
      || !Array.isArray(value.contributions)
      || !value.contributions.every(contribution => isRecord(contribution) && typeof contribution.kind === 'string')) {
      throw new Error('[Holo Panels] Discovered panel plugin preparation metadata is invalid.')
    }
    return {
      compatibility: value.compatibility,
      contributions: value.contributions as readonly PanelPluginContributionDefinition[],
      id: value.id,
      packageName: value.packageName,
    }
  })
}

function extensionTypeIds(plugins: readonly PanelPluginPreparationInput[]): readonly ExtensionTypeId[] {
  return plugins.flatMap(plugin => plugin.contributions.flatMap(contribution => contribution.kind === 'extension'
    ? [contribution.registration.typeId]
    : []))
}

function discoveryFailure(error: PanelsDiscoveryError): HoloProjectPrepareError {
  return new HoloProjectPrepareError({
    code: error.code,
    message: error.message,
    ...(error.location ? { source: { path: error.location.path } } : {}),
  })
}

export const preparer = defineHoloProjectPreparer({
  apiVersion: HOLO_PROJECT_PREPARE_API_VERSION,
  async prepare(context) {
    context.signal.throwIfAborted()

    let compiler = compilers.get(context.projectRoot)
    if (!compiler || context.run.kind === 'full') {
      compiler = new DiscoveryCompiler({
        projectRoot: context.projectRoot,
        loadModule: createProjectDiscoveryModuleLoader(context.projectRoot),
      })
      compilers.set(context.projectRoot, compiler)
    }

    try {
      const result = await compiler.compile(context.run.kind === 'incremental' ? context.run.changes : [])
      const activeFramework = frameworkId(context.framework?.id)
      const pluginInputs = result.definitions
        .filter(definition => definition.kind === 'panel')
        .flatMap(definition => pluginPreparationInputs(definition.server))

      if (!activeFramework) {
        if (pluginInputs.length > 0) throw new Error('[Holo Panels] Installed panel plugins require a detected framework during preparation.')
        return {
          kind: 'prepared',
          generatedArtifacts: result.artifacts,
          watch: { roots: result.watchRoots },
        } as const
      }

      const panels = result.definitions
        .filter(definition => definition.kind === 'panel')
        .map((definition) => {
          const clientPath = definition.client.path
          const path = typeof clientPath === 'string' ? clientPath : definition.route
          if (!path) {
            throw new PanelsDiscoveryError(
              'PANELS_DISCOVERY_PANEL_PATH_MISSING',
              `Panel ${definition.id} must define a path.`,
              { path: definition.projectPath, exportName: definition.exportName },
            )
          }
          return { id: definition.id, path }
        })
      const preparedPlugins = await preparePanelPlugins({
        framework: rendererFramework(activeFramework),
        plugins: pluginInputs,
        projectRoot: context.projectRoot,
        usedExtensions: extensionTypeIds(pluginInputs),
      })
      const ownershipPath = resolve(context.pluginGeneratedRoot, 'framework-artifacts.json')
      const previousOwnership = parseFrameworkOwnership(await readOptional(ownershipPath))
      const preliminary = planFrameworkArtifacts({
        framework: activeFramework,
        panels,
        ...(previousOwnership ? { previousOwnership } : {}),
      })
      const existingArtifacts = (await Promise.all(preliminary.writes.map(async artifact => ({
        path: artifact.path,
        contents: await readOptional(resolve(context.projectRoot, artifact.path)),
      }))))
        .filter((artifact): artifact is { path: string; contents: string } => artifact.contents !== undefined)
      const plan = planFrameworkArtifacts({
        framework: activeFramework,
        panels,
        existingArtifacts,
        ...(previousOwnership ? { previousOwnership } : {}),
      })
      for (const conflict of plan.conflicts) context.logger.warn(conflict.integrationSnippet)

      const existingByPath = new Map(existingArtifacts.map(artifact => [artifact.path, artifact.contents]))
      const managedArtifacts = [
        ...plan.writes.map(artifact => ({ path: artifact.path, contents: artifact.contents })),
        ...plan.unchanged.map(artifact => ({
          path: artifact.path,
          contents: existingByPath.get(artifact.path)!,
        })),
        ...preparedPlugins.managedArtifacts,
      ].sort((left, right) => left.path.localeCompare(right.path))
      const generatedArtifacts = result.artifacts.map(artifact => artifact.path === 'framework-artifacts.json'
        ? { path: artifact.path, contents: `${JSON.stringify(plan.ownership, null, 2)}\n` }
        : artifact)
      generatedArtifacts.push(
        { path: 'plugin-renderers.ts', contents: preparedPlugins.rendererModule },
        {
          path: 'plugins.json',
          contents: `${JSON.stringify({
              assets: preparedPlugins.assets,
              generatorTemplates: preparedPlugins.generatorTemplates,
              icons: preparedPlugins.icons,
            permissions: preparedPlugins.permissions,
            translations: preparedPlugins.translations,
            version: 1,
          }, null, 2)}\n`,
        },
      )

      return {
        kind: 'prepared',
        generatedArtifacts,
        managedArtifacts,
        watch: { roots: result.watchRoots },
      } as const
    } catch (error) {
      if (error instanceof PanelsDiscoveryError) throw discoveryFailure(error)
      throw error
    }
  },
})

export default preparer
