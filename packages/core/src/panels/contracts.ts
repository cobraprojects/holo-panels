import type { DiscoveryDirectories } from '../discovery/types'
import type { ComponentDefault } from '../defaults/component-default'
import type { CompiledPanelAuthServer, PanelAuthManifest } from '../auth/contracts'
import type { PanelNotificationOperation, PanelNotificationRecipient } from '../notifications/contracts'
import type { JsonObject } from '../protocol/json'
import type { PanelPluginInstallation } from '../plugins/panel-plugin'
import type { PluginCompatibility } from '../plugins/compatibility'
import type { CompiledPanelTenancy, PanelTenancyManifest, PanelTenantBootstrap } from '../tenancy/contracts'
import type { PanelRenderSlot, ScopedRenderSlots } from './render-slots'

export type PanelNavigationMode = 'sidebar' | 'topbar'
export type PanelDatabaseNotificationPlacement = 'sidebar' | 'topbar'
export type PanelDarkMode = 'dark' | 'light' | 'system'
export type PanelOperation = 'action' | 'bootstrap' | 'form-submit' | 'notification' | 'options' | 'page-data' | 'resolver' | 'table-data' | 'upload'

export interface PanelBranding {
  readonly favicon: string | null
  readonly logo: string | null
  readonly name: string
}

export interface PanelTheme {
  readonly colors: JsonObject
  readonly darkMode: PanelDarkMode
  readonly density: 'comfortable' | 'compact'
  readonly fontFamily: string | null
  readonly width: 'constrained' | 'full'
}

export interface PanelUserMenuItem {
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly path: string
}

export interface PanelDatabaseNotificationConfiguration {
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
  readonly auth: PanelAuthManifest | null
  readonly branding: PanelBranding
  readonly databaseNotifications: PanelDatabaseNotificationConfiguration | null
  readonly default: boolean
  readonly id: string
  readonly navigation: readonly PanelNavigationSeed[]
  readonly navigationMode: PanelNavigationMode
  readonly path: string
  readonly sidebarCollapsible: boolean
  readonly slots: ScopedRenderSlots<PanelRenderSlot>
  readonly theme: PanelTheme
  readonly tenancy: PanelTenancyManifest | null
  readonly userMenu: readonly PanelUserMenuItem[]
}

export interface PanelAccessContext<TActor> {
  readonly actor: TActor
  readonly guard: string
  readonly operation: PanelOperation
  readonly panelId: string
  readonly provider: string | null
  readonly signal: AbortSignal
}

export type PanelActorPresenter<TActor> = (actor: TActor) => JsonObject | Promise<JsonObject>

export interface CompiledPanelDefinition<TActor = unknown> {
  readonly discover: Readonly<DiscoveryDirectories>
  readonly guard: string
  readonly kind: 'panel'
  readonly manifest: PanelManifest
  readonly server: {
    readonly access: (context: PanelAccessContext<TActor>) => boolean | Promise<boolean>
    readonly auth?: CompiledPanelAuthServer<TActor>
    readonly notifications?: {
      readonly inbox: PanelDatabaseNotificationInboxOptions<TActor>
    }
    readonly defaults: readonly ComponentDefault[]
    readonly plugins: readonly (PanelPluginInstallation<TActor> & {
      readonly compatibility: PluginCompatibility
      readonly packageName: string
    })[]
    readonly presentActor: PanelActorPresenter<TActor>
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
  readonly manifest: PanelManifest
  readonly notifications: PanelNotificationBootstrap | null
  readonly provider: string | null
  readonly tenancy: PanelTenantBootstrap | null
}

export interface PanelNotificationBootstrap {
  readonly realtimeChannel: string | null
}
