import type { JsonObject, LocaleDirection, PanelManifest } from '@holo-js/panels-core'

export type PanelShellNavigationMode = 'sidebar' | 'topbar'
export type PanelShellViewport = 'desktop' | 'mobile' | 'tablet'
export type PanelShellErrorCode = 401 | 403 | 404 | 419 | 422 | 500 | 503

export interface PanelShellNavigationItem {
  badge: string | null
  group: string | null
  icon: string | null
  id: string
  label: string
  parent: string | null
  path: string
  sort: number
}

export interface PanelShellMenuItem {
  icon: string | null
  id: string
  label: string
  path: string
}

export interface PanelShellManifest {
  auth?: PanelManifest['auth']
  assets?: readonly {
    readonly id: string
    readonly src: string
    readonly type: 'css' | 'js'
  }[]
  branding: { avatarProvider?: string | null, darkModeLogo?: string | null, favicon: string | null, logo: string | null, logoHeight?: string | null, name: string }
  components?: {
    sidebar: string | null
    topbar: string | null
  }
  databaseNotifications: {
    component?: string | null
    lazy?: boolean
    placement: 'sidebar' | 'topbar'
    polling: false | number
    realtime: boolean
  } | null
  default: boolean
  globalSearch?: boolean
  globalSearchConfiguration?: {
    debounce: number
    enabled: boolean
    fieldSuffix: string | null
    keybindingSuffix: string | null
    keybindings: readonly string[]
    resourceOptIn?: boolean
  }
  id: string
  icons?: JsonObject
  navigation: readonly PanelShellNavigationItem[]
  navigationEnabled?: boolean
  navigationGroups?: readonly {
    readonly collapsible?: boolean
    readonly icon?: string | null
    readonly label: string
  }[]
  navigationMode: PanelShellNavigationMode
  layout?: {
    breadcrumbs: boolean
    collapsedSidebarWidth: string
    collapsibleNavigationGroups: boolean
    maxContentWidth: string
    sidebarFullyCollapsible: boolean
    sidebarWidth: string
    simplePageMaxContentWidth: string
    subNavigationPosition: 'end' | 'start' | 'top'
    topbar: boolean
  }
  locales?: PanelManifest['locales']
  path: string
  routing?: {
    domain: string | null
    domains: readonly string[]
    homeUrl: string | null
  }
  runtime?: {
    databaseTransactions: boolean
    readOnlyRelationManagersOnResourceViewPagesByDefault: boolean
    resourceCreatePageRedirect: 'edit' | 'index' | 'view'
    resourceEditPageRedirect: 'index' | 'view' | null
    spa: boolean
    spaPrefetching?: boolean
    spaUrlExceptions: readonly string[]
    strictAuthorization: boolean
    unsavedChangesAlerts: boolean
  }
  sidebarCollapsible: boolean
  slots: PanelManifest['slots']
  theme: {
    colors: JsonObject
    darkMode: 'dark' | 'light' | 'system'
    density: 'comfortable' | 'compact'
    fontFamily: string | null
    monoFontFamily?: string | null
    serifFontFamily?: string | null
    switcher?: boolean
    width: 'constrained' | 'full'
  }
  tenancy: {
    billing?: { readonly path: string } | null
    enabled: true
    menu?: boolean
    menuItems?: readonly PanelShellMenuItem[]
    profile?: { readonly path: string }
    registration?: { readonly path: string }
    requiresSubscription?: boolean
    routeDomain?: string | null
    routePrefix?: string | null
    searchableMenu?: boolean | null
    switcher?: boolean
  } | null
  userMenu: readonly PanelShellMenuItem[]
  userMenuEnabled?: boolean
}

export interface PanelChromeComponentProps<TPage = unknown> {
  readonly actor: JsonObject
  readonly manifest: PanelShellManifest
  readonly page: TPage
}

export interface PanelAvatarComponentProps {
  readonly actor: JsonObject
  readonly label: string
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
  direction: LocaleDirection
  locale: string
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
