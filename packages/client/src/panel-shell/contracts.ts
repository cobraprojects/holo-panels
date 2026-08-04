import type { JsonObject } from '@holo-js/panels-core'

export type PanelShellNavigationMode = 'sidebar' | 'topbar'
export type PanelShellViewport = 'desktop' | 'mobile' | 'tablet'
export type PanelShellErrorCode = 401 | 403 | 404 | 419 | 422 | 500 | 503

export interface PanelShellNavigationItem extends JsonObject {
  badge: string | null
  group: string | null
  icon: string | null
  id: string
  label: string
  parent: string | null
  path: string
  sort: number
}

export interface PanelShellMenuItem extends JsonObject {
  icon: string | null
  id: string
  label: string
  path: string
}

export interface PanelShellManifest {
  branding: { favicon: string | null, logo: string | null, name: string }
  databaseNotifications: {
    placement: 'sidebar' | 'topbar'
    polling: false | number
    realtime: boolean
  } | null
  default: boolean
  id: string
  navigation: readonly PanelShellNavigationItem[]
  navigationMode: PanelShellNavigationMode
  path: string
  sidebarCollapsible: boolean
  theme: {
    colors: JsonObject
    darkMode: 'dark' | 'light' | 'system'
    density: 'comfortable' | 'compact'
    fontFamily: string | null
    width: 'constrained' | 'full'
  }
  tenancy: {
    enabled: true
    profile?: { readonly path: string }
    registration?: { readonly path: string }
  } | null
  userMenu: readonly PanelShellMenuItem[]
}

export interface PanelShellTenantPresentation extends JsonObject {
  avatarUrl: string | null
  description: string | null
  label: string
  routeKey: string
}

export interface PanelShellTenancyBootstrap {
  readonly active: PanelShellTenantPresentation | null
  readonly memberships: {
    readonly memberships: readonly PanelShellTenantPresentation[]
    readonly nextCursor: string | null
  }
}

export interface PanelTenantSwitcherTransport {
  switch(routeKey: string, signal: AbortSignal): Promise<Readonly<{ tenant: { id: number | string, routeKey: string } }>>
}

export interface PanelShellBootstrap {
  actor: JsonObject
  manifest: PanelShellManifest
  notifications: { realtimeChannel: string | null } | null
  provider: string | null
  tenancy: PanelShellTenancyBootstrap | null
}

export interface PanelShellError {
  readonly code: PanelShellErrorCode
  readonly message: string
  readonly requestId: string | null
  readonly retryable: boolean
}

export interface PanelShellState {
  readonly activeNavigationId: string | null
  readonly activePath: string
  readonly actor: JsonObject | null
  readonly error: PanelShellError | null
  readonly manifest: Readonly<PanelShellManifest> | null
  readonly notifications: Readonly<{ realtimeChannel: string | null }> | null
  readonly panelId: string
  readonly provider: string | null
  readonly sidebarOpen: boolean
  readonly tenancy: Readonly<PanelShellTenancyBootstrap> | null
  readonly userMenuOpen: boolean
  readonly viewport: PanelShellViewport
}

export type PanelShellStateListener = (state: PanelShellState, previous: PanelShellState) => void
