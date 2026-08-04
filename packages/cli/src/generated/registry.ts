import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { DISCOVERABLE_KINDS, type DiscoveredDefinition } from '../discovery/types'
import { PanelsDiscoveryError } from '../discovery/error'

export interface GeneratedPanelsRegistry {
  readonly version: 1
  readonly definitions: readonly DiscoveredDefinition[]
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isGeneratedDefinition(value: unknown): value is DiscoveredDefinition {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.panelId === 'string'
    && typeof value.projectPath === 'string'
    && typeof value.exportName === 'string'
    && typeof value.kind === 'string'
    && DISCOVERABLE_KINDS.includes(value.kind as DiscoveredDefinition['kind'])
    && Array.isArray(value.permissionKeys)
    && Array.isArray(value.componentKeys)
    && Array.isArray(value.navigationKeys)
    && typeof value.default === 'boolean'
    && isRecord(value.client)
}

export function parseGeneratedPanelsRegistry(contents: string): GeneratedPanelsRegistry {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents) as unknown
  } catch {
    throw new PanelsDiscoveryError('PANELS_GENERATED_REGISTRY_INVALID', 'Generated Holo Panels registry contains invalid JSON.')
  }

  if (!isRecord(parsed)
    || parsed.version !== 1
    || !Array.isArray(parsed.definitions)
    || !parsed.definitions.every(isGeneratedDefinition)) {
    throw new PanelsDiscoveryError('PANELS_GENERATED_REGISTRY_INVALID', 'Generated Holo Panels registry has an invalid structure.')
  }

  return Object.freeze({
    version: 1,
    definitions: Object.freeze(parsed.definitions.flatMap(value => isGeneratedDefinition(value) ? [value] : [])),
  })
}

export async function loadGeneratedPanelsRegistry(projectRoot: string): Promise<GeneratedPanelsRegistry> {
  const path = resolve(projectRoot, '.holo-js/generated/panels/registry.json')
  const contents = await readFile(path, 'utf8').catch(() => undefined)
  if (!contents) {
    throw new PanelsDiscoveryError('PANELS_GENERATED_REGISTRY_MISSING', 'Run holo prepare to generate the Holo Panels registry.', { path: '.holo-js/generated/panels/registry.json' })
  }
  return parseGeneratedPanelsRegistry(contents)
}
