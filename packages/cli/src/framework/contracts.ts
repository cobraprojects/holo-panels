export type FrameworkId = 'next' | 'nuxt' | 'sveltekit'

export type DiscoveredPanelPath = {
  readonly id: string
  readonly path: string
}

export type FrameworkArtifactKind = 'panel-page' | 'operation-endpoint'

export type FrameworkArtifactOwnership = {
  readonly path: string
  readonly framework: FrameworkId
  readonly kind: FrameworkArtifactKind
  readonly checksum: string
  readonly panelIds: readonly string[]
}

export type FrameworkArtifactManifest = {
  readonly version: 1
  readonly artifacts: readonly FrameworkArtifactOwnership[]
}

export type ExistingFrameworkArtifact = {
  readonly path: string
  readonly contents: string
}

export type FrameworkArtifactWrite = FrameworkArtifactOwnership & {
  readonly contents: string
  readonly status: 'create' | 'update'
}

export type FrameworkArtifactConflict = {
  readonly path: string
  readonly reason: 'unmanaged-file' | 'managed-file-modified'
  readonly integrationSnippet: string
}

export type FrameworkArtifactPlan = {
  readonly writes: readonly FrameworkArtifactWrite[]
  readonly unchanged: readonly FrameworkArtifactOwnership[]
  readonly conflicts: readonly FrameworkArtifactConflict[]
  readonly ownership: FrameworkArtifactManifest
}

export type PlanFrameworkArtifactsInput = {
  readonly framework: FrameworkId
  readonly panels: readonly DiscoveredPanelPath[]
  readonly existingArtifacts?: readonly ExistingFrameworkArtifact[]
  readonly previousOwnership?: FrameworkArtifactManifest
}
