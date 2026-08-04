import { createHash } from 'node:crypto'
import type {
  DiscoveredPanelPath,
  FrameworkArtifactConflict,
  FrameworkArtifactManifest,
  FrameworkArtifactOwnership,
  FrameworkArtifactPlan,
  FrameworkArtifactWrite,
  PlanFrameworkArtifactsInput,
} from './contracts'
import { frameworkArtifactTemplates, MANAGED_ARTIFACT_MARKER } from './templates'

const PANEL_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const PANEL_PATH_SEGMENT_PATTERN = /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?$/

function checksum(contents: string): string {
  return createHash('sha256').update(contents).digest('hex')
}

function ownershipHeader(path: string, bodyChecksum: string): string {
  if (path.endsWith('.vue') || path.endsWith('.svelte')) return `<!-- ${MANAGED_ARTIFACT_MARKER}${bodyChecksum} -->`
  return `// ${MANAGED_ARTIFACT_MARKER}${bodyChecksum}`
}

function managedContents(path: string, body: string): { readonly checksum: string, readonly contents: string } {
  const bodyChecksum = checksum(body)
  return {
    checksum: bodyChecksum,
    contents: `${ownershipHeader(path, bodyChecksum)}\n${body}`,
  }
}

function normalizePanel(panel: DiscoveredPanelPath): DiscoveredPanelPath {
  if (!PANEL_ID_PATTERN.test(panel.id)) {
    throw new Error(`[Holo Panels] Invalid panel ID "${panel.id}". Use lowercase letters, numbers, and single hyphens.`)
  }
  const segments = panel.path.trim().split('/').filter(Boolean)
  if (segments[0] === '_holo') {
    throw new Error(`[Holo Panels] Panel "${panel.id}" cannot use the reserved /_holo path.`)
  }
  if (segments.some(segment => !PANEL_PATH_SEGMENT_PATTERN.test(segment))) {
    throw new Error(`[Holo Panels] Invalid path for panel "${panel.id}": ${panel.path}.`)
  }
  const normalizedPath = segments.length === 0 ? '/' : `/${segments.join('/')}`
  return Object.freeze({ id: panel.id, path: normalizedPath })
}

function assertUniquePanels(panels: readonly DiscoveredPanelPath[]): void {
  const ids = new Set<string>()
  for (const panel of panels) {
    if (ids.has(panel.id)) throw new Error(`[Holo Panels] Duplicate panel ID "${panel.id}".`)
    ids.add(panel.id)
  }
}

function assertNoPathOverlap(panels: readonly DiscoveredPanelPath[]): void {
  for (const [index, panel] of panels.entries()) {
    for (const other of panels.slice(index + 1)) {
      const overlaps = panel.path === '/'
        || other.path === '/'
        || panel.path === other.path
        || panel.path.startsWith(`${other.path}/`)
        || other.path.startsWith(`${panel.path}/`)
      if (overlaps) {
        throw new Error(`[Holo Panels] Panel paths overlap: "${panel.id}" (${panel.path}) and "${other.id}" (${other.path}).`)
      }
    }
  }
}

function ownershipKey(ownership: FrameworkArtifactOwnership): string {
  return `${ownership.framework}:${ownership.path}`
}

function validManagedContents(path: string, contents: string, expectedChecksum: string): boolean {
  const newlineIndex = contents.indexOf('\n')
  if (newlineIndex < 0) return false
  const header = contents.slice(0, newlineIndex)
  const body = contents.slice(newlineIndex + 1)
  return header === ownershipHeader(path, expectedChecksum) && checksum(body) === expectedChecksum
}

function integrationSnippet(path: string, contents: string): string {
  return `Manual integration required for ${path}:\n\n${contents}`
}

function freezeOwnership(ownership: FrameworkArtifactOwnership): FrameworkArtifactOwnership {
  return Object.freeze({ ...ownership, panelIds: Object.freeze([...ownership.panelIds]) })
}

function freezeManifest(artifacts: readonly FrameworkArtifactOwnership[]): FrameworkArtifactManifest {
  return Object.freeze({ version: 1, artifacts: Object.freeze(artifacts.map(freezeOwnership)) })
}

export function planFrameworkArtifacts(input: PlanFrameworkArtifactsInput): FrameworkArtifactPlan {
  const panels = input.panels.map(normalizePanel).sort((left, right) => left.path.localeCompare(right.path) || left.id.localeCompare(right.id))
  assertUniquePanels(panels)
  assertNoPathOverlap(panels)

  const existingByPath = new Map((input.existingArtifacts ?? []).map(artifact => [artifact.path, artifact.contents]))
  const previousByKey = new Map((input.previousOwnership?.artifacts ?? []).map(ownership => [ownershipKey(ownership), ownership]))
  const writes: FrameworkArtifactWrite[] = []
  const unchanged: FrameworkArtifactOwnership[] = []
  const conflicts: FrameworkArtifactConflict[] = []
  const resultingOwnership: FrameworkArtifactOwnership[] = []

  const templates = [...frameworkArtifactTemplates(input.framework, panels)]
    .sort((left, right) => left.path.localeCompare(right.path))
  for (const template of templates) {
    const managed = managedContents(template.path, template.body)
    const ownership = freezeOwnership({
      path: template.path,
      framework: input.framework,
      kind: template.kind,
      checksum: managed.checksum,
      panelIds: template.panelIds,
    })
    const existing = existingByPath.get(template.path)
    if (typeof existing === 'undefined') {
      writes.push(Object.freeze({ ...ownership, contents: managed.contents, status: 'create' }))
      resultingOwnership.push(ownership)
      continue
    }
    const previous = previousByKey.get(ownershipKey(ownership))
    if (!previous) {
      conflicts.push(Object.freeze({
        path: template.path,
        reason: 'unmanaged-file',
        integrationSnippet: integrationSnippet(template.path, managed.contents),
      }))
      continue
    }
    if (!validManagedContents(template.path, existing, previous.checksum)) {
      conflicts.push(Object.freeze({
        path: template.path,
        reason: 'managed-file-modified',
        integrationSnippet: integrationSnippet(template.path, managed.contents),
      }))
      resultingOwnership.push(previous)
      continue
    }
    if (existing === managed.contents && previous.checksum === managed.checksum) {
      unchanged.push(ownership)
      resultingOwnership.push(ownership)
      continue
    }
    writes.push(Object.freeze({ ...ownership, contents: managed.contents, status: 'update' }))
    resultingOwnership.push(ownership)
  }

  return Object.freeze({
    writes: Object.freeze(writes),
    unchanged: Object.freeze(unchanged),
    conflicts: Object.freeze(conflicts),
    ownership: freezeManifest(resultingOwnership),
  })
}

export function printFrameworkArtifactConflicts(
  plan: Pick<FrameworkArtifactPlan, 'conflicts'>,
  output: (message: string) => void = message => process.stdout.write(message),
): void {
  for (const conflict of plan.conflicts) output(`${conflict.integrationSnippet}\n`)
}
