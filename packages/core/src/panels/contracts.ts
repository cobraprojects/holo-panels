import type { DiscoverableDefinition, DiscoveryDirectories } from '../discovery/types'
import type { ComponentDefault } from '../defaults/component-default'
import type { CompiledPanelAuthServer, PanelAuthManifest } from '../auth/contracts'
import type { PanelNotificationOperation, PanelNotificationRecipient } from '../notifications/contracts'
import type { JsonObject } from '../protocol/json'
import type { LocaleDirection } from '../translations/contracts'
import type { PanelPluginInstallation } from '../plugins/panel-plugin'
import type { PluginCompatibility } from '../plugins/compatibility'
import type { CompiledPanelTenancy, PanelTenancyManifest, PanelTenantBootstrap } from '../tenancy/contracts'
import type { RenderHook, ScopedRenderSlots } from './render-slots'

export type PanelNavigationMode = 'sidebar' | 'topbar'
export type PanelDatabaseNotificationPlacement = 'sidebar' | 'topbar'
export type PanelDarkMode = 'dark' | 'light' | 'system'
export type PanelOperation = 'action' | 'bootstrap' | 'form-submit' | 'global-search' | 'notification' | 'options' | 'page-data' | 'resolver' | 'route' | 'table-data' | 'upload'
export type PanelRouteMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT'
export type PanelRouteScope = 'authenticated' | 'authenticated-tenant' | 'public' | 'tenant'
export type PanelContentWidth = 'screen-2xl' | 'screen-xl' | 'screen-lg' | 'screen-md' | 'screen-sm' | 'full' | string
export type PanelSubNavigationPosition = 'end' | 'start' | 'top'
export type PanelThemeMode = 'dark' | 'light' | 'system'

export interface PanelBranding {
  readonly avatarProvider?: string | null
  readonly darkModeLogo?: string | null
  readonly favicon: string | null
  readonly logo: string | null
  readonly logoHeight?: string | null
  readonly name: string
}

export interface PanelTheme {
  readonly colors: JsonObject
  readonly darkMode: PanelDarkMode
  readonly density: 'comfortable' | 'compact'
  readonly fontFamily: string | null
  readonly monoFontFamily?: string | null
  readonly name?: string
  readonly tokens?: JsonObject
  readonly serifFontFamily?: string | null
  readonly switcher?: boolean
  readonly width: 'constrained' | 'full'
}

export interface PanelLayoutConfiguration {
  readonly breadcrumbs: boolean
  readonly collapsedSidebarWidth: string
  readonly collapsibleNavigationGroups: boolean
  readonly maxContentWidth: PanelContentWidth
  readonly sidebarFullyCollapsible: boolean
  readonly sidebarWidth: string
  readonly simplePageMaxContentWidth: PanelContentWidth
  readonly subNavigationPosition: PanelSubNavigationPosition
  readonly topbar: boolean
}

export interface PanelGlobalSearchConfiguration {
  readonly debounce: number
  readonly enabled: boolean
  readonly fieldSuffix: string | null
  readonly keybindingSuffix: string | null
  readonly keybindings: readonly string[]
  readonly resourceOptIn?: boolean
}

export interface PanelRoutingConfiguration {
  readonly domain: string | null
  readonly domains: readonly string[]
  readonly homeUrl: string | null
}

export interface PanelRuntimeConfiguration {
  readonly broadcasting?: boolean
  readonly databaseTransactions: boolean
  readonly readOnlyRelationManagersOnResourceViewPagesByDefault: boolean
  readonly resourceCreatePageRedirect: 'edit' | 'index' | 'view'
  readonly resourceEditPageRedirect: 'index' | 'view' | null
  readonly spa: boolean
  readonly spaPrefetching?: boolean
  readonly spaUrlExceptions: readonly string[]
  readonly strictAuthorization: boolean
  readonly unsavedChangesAlerts: boolean
}

export interface PanelComponentConfiguration {
  readonly sidebar: string | null
  readonly topbar: string | null
}

export interface PanelErrorNotification {
  readonly body: string
  readonly statusCode: number | null
  readonly title: string
}

export interface PanelErrorNotificationConfiguration {
  readonly disabledStatusCodes: readonly number[]
  readonly enabled: boolean
  readonly hiddenStatusCodes: readonly number[]
  readonly notifications: readonly PanelErrorNotification[]
}

export interface PanelNavigationGroup {
  readonly collapsible?: boolean
  readonly icon?: string | null
  readonly label: string
}

export interface PanelAsset {
  readonly id: string
  readonly src: string
  readonly type: 'css' | 'js'
}

export type PanelRouteHandler = (request: Request) => Response | Promise<Response>

export interface PanelRouteRegistry {
  delete(path: string, handler: PanelRouteHandler): void
  get(path: string, handler: PanelRouteHandler): void
  patch(path: string, handler: PanelRouteHandler): void
  post(path: string, handler: PanelRouteHandler): void
  put(path: string, handler: PanelRouteHandler): void
  route(method: PanelRouteMethod, path: string, handler: PanelRouteHandler): void
}

export type PanelRouteRegistrar = (routes: PanelRouteRegistry) => void

export interface CompiledPanelRoute {
  readonly handler: PanelRouteHandler
  readonly method: PanelRouteMethod
  readonly path: string
  readonly scope: PanelRouteScope
}

export interface ResolvedPanelRoute {
  readonly definition: CompiledPanelRoute
  readonly parameters: Readonly<Record<string, string>>
}

export interface PanelMiddlewareContext<TActor> extends PanelAuthenticatedScope<TActor> {
  readonly operation: PanelOperation
}

export type PanelMiddleware<TActor> = (
  context: PanelMiddlewareContext<TActor>,
  next: () => Promise<unknown>,
) => unknown | Promise<unknown>

export interface PanelTokenTheme {
  readonly colorScheme: 'dark' | 'light'
  readonly name: string
  readonly tokens: Readonly<Record<string, string>>
}

export interface PanelUserMenuItem {
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly path: string
}

export interface PanelRegisteredDefinition {
  readonly definition: DiscoverableDefinition<'cluster' | 'page' | 'resource' | 'widget'>
  readonly value: object
}

export interface PanelDatabaseNotificationConfiguration {
  readonly component?: string | null
  readonly lazy?: boolean
  readonly placement: PanelDatabaseNotificationPlacement
  readonly polling: false | number
  readonly realtime: boolean
}

export interface PanelDatabaseNotificationIdentity {
  readonly recipient: PanelNotificationRecipient
  readonly realtimeChannel: string | null
  readonly tenantId: string | number | null
}

export interface PanelDatabaseNotificationInboxOptions<TActor> {
  authorize(
    operation: PanelNotificationOperation,
    scope: PanelAuthenticatedScope<TActor>,
  ): boolean | Promise<boolean>
  resolve(
    scope: PanelAuthenticatedScope<TActor>,
  ): PanelDatabaseNotificationIdentity | Promise<PanelDatabaseNotificationIdentity>
}

export interface PanelNavigationSeed {
  readonly badge: string | null
  readonly group: string | null
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly parent: string | null
  readonly path: string
  readonly sort: number
}

export interface PanelManifest {
  readonly assets?: readonly PanelAsset[]
  readonly auth: PanelAuthManifest | null
  readonly branding: PanelBranding
  readonly components?: PanelComponentConfiguration
  readonly databaseNotifications: PanelDatabaseNotificationConfiguration | null
  readonly default: boolean
  readonly errorNotifications?: PanelErrorNotificationConfiguration
  readonly globalSearch: boolean
  readonly globalSearchConfiguration?: PanelGlobalSearchConfiguration
  readonly id: string
  readonly navigation: readonly PanelNavigationSeed[]
  readonly navigationEnabled?: boolean
  readonly navigationGroups?: readonly PanelNavigationGroup[]
  readonly navigationMode: PanelNavigationMode
  readonly layout?: PanelLayoutConfiguration
  readonly locales: {
    readonly allowed: readonly string[]
    readonly fallback: string
  }
  readonly path: string
  readonly routing?: PanelRoutingConfiguration
  readonly runtime?: PanelRuntimeConfiguration
  readonly sidebarCollapsible: boolean
  readonly slots: ScopedRenderSlots<RenderHook>
  readonly theme: PanelTheme
  readonly icons?: JsonObject
  readonly tenancy: PanelTenancyManifest | null
  readonly userMenu: readonly PanelUserMenuItem[]
  readonly userMenuEnabled?: boolean
}

export interface PanelAccessContext<TActor> {
  readonly actor: TActor
  readonly guard: string
  readonly operation: PanelOperation
  readonly panelId: string
  readonly provider: string | null
  readonly signal: AbortSignal
}

export interface PanelBootContext {
  readonly guard: string
  readonly manifest: PanelManifest
}

export type PanelActorPresenter<TActor> = (actor: TActor) => JsonObject | Promise<JsonObject>

export interface CompiledPanelDefinition<TActor = unknown> {
  readonly discover: Readonly<DiscoveryDirectories>
  readonly guard: string
  readonly kind: 'panel'
  readonly manifest: PanelManifest
  readonly server: {
    readonly access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>
    readonly boot?: readonly ((panel: PanelBootContext) => void | Promise<void>)[]
    readonly auth?: CompiledPanelAuthServer<TActor>
    readonly notifications?: {
      readonly inbox: PanelDatabaseNotificationInboxOptions<TActor>
    }
    readonly defaults: readonly ComponentDefault[]
    readonly middleware?: {
      readonly authenticated: readonly PanelMiddleware<TActor>[]
      readonly panel: readonly PanelMiddleware<TActor>[]
      readonly persistent?: {
        readonly authenticated: readonly PanelMiddleware<TActor>[]
        readonly panel: readonly PanelMiddleware<TActor>[]
        readonly tenant: readonly PanelMiddleware<TActor>[]
      }
      readonly tenant: readonly PanelMiddleware<TActor>[]
    }
    readonly plugins: readonly (PanelPluginInstallation<TActor> & {
      readonly compatibility: PluginCompatibility
      readonly packageName: string
    })[]
    readonly registered: readonly PanelRegisteredDefinition[]
    readonly presentActor: PanelActorPresenter<TActor>
    readonly routes?: readonly CompiledPanelRoute[]
    readonly tenancy?: CompiledPanelTenancy<TActor>
  }
}

export interface HoloAuthGuard<TActor> {
  flash?(key: string, value: unknown): Promise<void>
  provider(): Promise<string | null>
  take?<TValue = unknown>(key: string): Promise<TValue | undefined>
  user(): Promise<TActor | null>
}

export interface HoloAuth<TActor> {
  guard(name: string): HoloAuthGuard<TActor>
}

export interface PanelAuthenticatedScope<TActor> {
  readonly actor: TActor
  readonly guard: string
  readonly panelId: string
  readonly provider: string | null
  readonly signal: AbortSignal
}

export interface PanelBootstrap {
  readonly actor: JsonObject
  readonly direction: LocaleDirection
  readonly locale: string
  readonly manifest: PanelManifest
  readonly notifications: PanelNotificationBootstrap | null
  readonly provider: string | null
  readonly tenancy: PanelTenantBootstrap | null
}

export interface PanelNotificationBootstrap {
  readonly realtimeChannel: string | null
}
