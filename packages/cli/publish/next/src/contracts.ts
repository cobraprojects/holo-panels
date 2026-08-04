import type {
  ClientNotificationRealtime,
  Effect,
  HoloAuth,
  JsonObject,
  JsonValue,
  PanelOperation,
  ResolvedPageData,
  PanelShellBootstrap,
  PanelTenantSwitcherTransport,
} from '@holo-js/panels-react'

export type NextPanelRegistryValue = object

export type NextPanelServerRegistry = Readonly<Record<string, () => Promise<NextPanelRegistryValue>>>

export interface NextPanelRequestScope {
  readonly actor: object
  readonly locale: string
  readonly panelId: string
  readonly parameters: Readonly<Record<string, string>>
  readonly provider: string | null
  readonly request: Request
  readonly services: unknown
  readonly signal: AbortSignal
  readonly tenant: unknown
}

export interface NextPanelOperationInput {
  readonly operation: PanelOperation
  readonly panelId: string
  readonly payload: JsonObject
  readonly request: Request
  readonly scope: NextPanelRequestScope
}

export interface NextPanelOperationResult {
  readonly data?: JsonValue
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface NextPanelsRuntime {
  readonly auth: HoloAuth<object> | (() => HoloAuth<object> | Promise<HoloAuth<object>>)
  readonly registry: NextPanelServerRegistry
  readonly resolveLocale?: (request: Request) => string | Promise<string>
  readonly resolveServices?: (request: Request) => unknown | Promise<unknown>
  readonly resolveTenant?: (request: Request) => unknown | Promise<unknown>
  readonly execute?: (input: NextPanelOperationInput) => NextPanelOperationResult | Promise<NextPanelOperationResult>
}

export interface CreatePanelPageOptions {
  readonly panelId: string
  readonly runtime?: NextPanelsRuntime
}

export interface CreatePanelOperationRouteOptions {
  readonly panelIds: readonly string[]
  readonly runtime?: NextPanelsRuntime
}

export interface NextPanelPageProps {
  readonly params: Promise<{ readonly panelsPath?: readonly string[] }>
}

export interface NextPanelPagePayload {
  readonly bootstrap: PanelShellBootstrap
  readonly effects: readonly Effect[]
  readonly page: ResolvedPageData<JsonObject>
  readonly path: string
}

export interface NextPanelRouteContext {
  readonly params: Promise<{ readonly operation: string, readonly panelId: string }>
}

export interface NextPanelClientProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly payload: NextPanelPagePayload
  readonly tenantTransport?: PanelTenantSwitcherTransport
}
