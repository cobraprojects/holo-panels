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
const PANEL_ROUTE_SEGMENT_PATTERN = /^(?:[a-z0-9][a-z0-9._~-]*|:[a-z][a-z0-9_]*)$/u

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
  if (segments[0] === 'holo') {
    throw new Error(`[Holo Panels] Panel "${panel.id}" cannot use the reserved /holo path.`)
  }
  if (segments.some(segment => !PANEL_PATH_SEGMENT_PATTERN.test(segment))) {
    throw new Error(`[Holo Panels] Invalid path for panel "${panel.id}": ${panel.path}.`)
  }
  const normalizedPath = segments.length === 0 ? '/' : `/${segments.join('/')}`
  const normalizeAuthPath = (value: string | undefined, label: string): string | undefined => {
    const authSegments = value?.trim().split('/').filter(Boolean)
    if (authSegments?.some(segment => !PANEL_PATH_SEGMENT_PATTERN.test(segment))) {
      throw new Error(`[Holo Panels] Invalid ${label} path for panel "${panel.id}": ${value}.`)
    }
    return authSegments ? `/${authSegments.join('/')}` : undefined
  }
  const forgotPasswordPath = normalizeAuthPath(panel.forgotPasswordPath, 'forgot password')
  const loginPath = normalizeAuthPath(panel.loginPath, 'login')
  const registrationPath = normalizeAuthPath(panel.registrationPath, 'registration')
  const emailChangeVerificationPath = normalizeAuthPath(panel.emailChangeVerificationPath, 'email change verification')
  const emailVerificationPath = normalizeAuthPath(panel.emailVerificationPath, 'email verification')
  const emailVerificationVerifyPath = normalizeAuthPath(panel.emailVerificationVerifyPath, 'email verification callback')
  const mfaChallengePath = normalizeAuthPath(panel.mfaChallengePath, 'multi-factor challenge')
  const mfaEnrollmentPath = normalizeAuthPath(panel.mfaEnrollmentPath, 'multi-factor enrollment')
  const mfaRecoveryCodesPath = normalizeAuthPath(panel.mfaRecoveryCodesPath, 'multi-factor recovery codes')
  const passwordResetPath = normalizeAuthPath(panel.passwordResetPath, 'password reset')
  const profilePath = normalizeAuthPath(panel.profilePath, 'profile')
  const appearance = panel.appearance
    ? Object.freeze({
        ...panel.appearance,
        ...(panel.appearance.colors ? { colors: Object.freeze({ ...panel.appearance.colors }) } : {}),
        ...(panel.appearance.tokens ? { tokens: Object.freeze({ ...panel.appearance.tokens }) } : {}),
      })
    : undefined
  const routes = (panel.routes ?? []).map((route) => {
    const routeSegments = route.source.split('/').filter(Boolean)
    if (routeSegments.some(segment => !PANEL_ROUTE_SEGMENT_PATTERN.test(segment))) throw new Error(`[Holo Panels] Invalid custom route for panel "${panel.id}": ${route.source}.`)
    return Object.freeze({ ...route, source: joinedRoutePath(routeSegments) })
  })
  return Object.freeze({
    ...(appearance ? { appearance } : {}),
    ...(panel.brandingName ? { brandingName: panel.brandingName } : {}),
    ...(panel.darkMode ? { darkMode: panel.darkMode } : {}),
    ...(emailChangeVerificationPath ? { emailChangeVerificationPath } : {}),
    ...(emailVerificationPath ? { emailVerificationPath } : {}),
    ...(emailVerificationVerifyPath ? { emailVerificationVerifyPath } : {}),
    ...(forgotPasswordPath ? { forgotPasswordPath } : {}),
    id: panel.id,
    ...(loginPath ? { loginPath } : {}),
    ...(mfaChallengePath ? { mfaChallengePath } : {}),
    ...(mfaEnrollmentPath ? { mfaEnrollmentPath } : {}),
    ...(mfaRecoveryCodesPath ? { mfaRecoveryCodesPath } : {}),
    path: normalizedPath,
    ...(passwordResetPath ? { passwordResetPath } : {}),
    ...(profilePath ? { profilePath } : {}),
    ...(registrationPath ? { registrationPath } : {}),
    ...(routes.length > 0 ? { routes: Object.freeze(routes) } : {}),
    ...(panel.simplePageMaxContentWidth ? { simplePageMaxContentWidth: panel.simplePageMaxContentWidth } : {}),
    ...(panel.themeColors ? { themeColors: Object.freeze({ ...panel.themeColors }) } : {}),
  })
}

function joinedRoutePath(segments: readonly string[]): string {
  return segments.length === 0 ? '/' : `/${segments.join('/')}`
}

function normalizeDirectory(value: string, name: string): string {
  const normalized = value.trim().replaceAll('\\', '/')
  if (normalized === '.') return '.'
  const segments = normalized.split('/').filter(segment => segment && segment !== '.')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:\//i.test(normalized) || segments.includes('..')) {
    throw new Error(`[Holo Panels] Invalid ${name} directory: ${value}.`)
  }
  return segments.join('/')
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

function managedContentsChecksum(path: string, contents: string): string | null {
  const newlineIndex = contents.indexOf('\n')
  if (newlineIndex < 0) return null
  const header = contents.slice(0, newlineIndex)
  const body = contents.slice(newlineIndex + 1)
  const bodyChecksum = checksum(body)
  return header === ownershipHeader(path, bodyChecksum) ? bodyChecksum : null
}

function validManagedContents(path: string, contents: string, expectedChecksum: string): boolean {
  return managedContentsChecksum(path, contents) === expectedChecksum
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

  const directories = input.directories
    ? {
        pages: normalizeDirectory(input.directories.pages, 'pages'),
        server: normalizeDirectory(input.directories.server, 'server'),
      }
    : undefined
  const templates = [...frameworkArtifactTemplates(input.framework, panels, directories)]
    .sort((left, right) => left.path.localeCompare(right.path))
  const templatePaths = new Set<string>()
  for (const template of templates) {
    if (templatePaths.has(template.path)) {
      throw new Error(`[Holo Panels] Multiple generated routes target ${template.path}. Configure unique panel and login paths.`)
    }
    templatePaths.add(template.path)
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
      if (validManagedContents(template.path, existing, managed.checksum)) {
        unchanged.push(ownership)
        resultingOwnership.push(ownership)
        continue
      }
      if (managedContentsChecksum(template.path, existing) !== null) {
        writes.push(Object.freeze({ ...ownership, contents: managed.contents, status: 'update' }))
        resultingOwnership.push(ownership)
        continue
      }
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
