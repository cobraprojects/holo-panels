export type FrameworkId = 'next' | 'nuxt' | 'sveltekit'

export type DiscoveredPanelPath = {
  readonly brandingName?: string
  readonly darkMode?: 'dark' | 'light' | 'system'
  readonly emailChangeVerificationPath?: string
  readonly emailVerificationPath?: string
  readonly emailVerificationVerifyPath?: string
  readonly forgotPasswordPath?: string
  readonly id: string
  readonly loginPath?: string
  readonly mfaChallengePath?: string
  readonly mfaEnrollmentPath?: string
  readonly mfaRecoveryCodesPath?: string
  readonly path: string
  readonly passwordResetPath?: string
  readonly profilePath?: string
  readonly routes?: readonly {
    readonly domain: string | null
    readonly method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
    readonly scope: 'authenticated' | 'authenticated-tenant' | 'public' | 'tenant'
    readonly source: string
  }[]
  readonly registrationPath?: string
  readonly simplePageMaxContentWidth?: string
  readonly themeColors?: Readonly<Record<string, string>>
}

export type FrameworkArtifactKind = 'auth-page' | 'panel-page' | 'operation-endpoint'

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

export type FrameworkArtifactDirectories = {
  readonly pages: string
  readonly server: string
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
  readonly directories?: FrameworkArtifactDirectories
  readonly framework: FrameworkId
  readonly panels: readonly DiscoveredPanelPath[]
  readonly existingArtifacts?: readonly ExistingFrameworkArtifact[]
  readonly previousOwnership?: FrameworkArtifactManifest
}
