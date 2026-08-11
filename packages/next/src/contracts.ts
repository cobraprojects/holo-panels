import type {
  ClientNotificationRealtime,
  ComponentRegistry,
  Effect,
  HoloAuth,
  JsonObject,
  JsonValue,
  PanelOperation,
  ResolvedPageData,
  PanelShellBootstrap,
  PanelTenantSwitcherTransport,
} from '@holo-js/panels-react'
import type { ResolvedWidget } from '@holo-js/panels-react/server'
import type { ComponentType } from 'react'

export type NextPanelRegistryValue = object

export type NextPanelServerRegistry = Readonly<Record<string, () => Promise<NextPanelRegistryValue>>>

export interface NextPanelRequestScope<
  TActor extends object = object,
  TServices = unknown,
  TTenant = unknown,
> {
  readonly actor: TActor
  readonly locale: string
  readonly panelId: string
  readonly parameters: Readonly<Record<string, string>>
  readonly provider: string | null
  readonly request: Request
  readonly services: TServices | undefined
  readonly signal: AbortSignal
  readonly tenant: TTenant | undefined
  readonly tenantBindings?: Readonly<Record<string, number | string>>
  readonly scopeTenantQuery?: <TQuery>(query: TQuery) => TQuery
}

export interface NextPanelOperationInput<
  TActor extends object = object,
  TServices = unknown,
  TTenant = unknown,
  TPayload extends JsonObject = JsonObject,
> {
  readonly operation: PanelOperation
  readonly panelId: string
  readonly payload: TPayload
  readonly request: Request
  readonly scope: NextPanelRequestScope<TActor, TServices, TTenant>
}

export interface NextPanelOperationResult<TResult extends JsonValue = JsonValue> {
  readonly data?: TResult
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface NextPanelsRuntime<
  TActor extends object = object,
  TServices = unknown,
  TTenant = unknown,
  TPayload extends JsonObject = JsonObject,
  TResult extends JsonValue = JsonValue,
> {
  readonly auth: HoloAuth<TActor> | (() => HoloAuth<TActor> | Promise<HoloAuth<TActor>>)
  readonly registry: NextPanelServerRegistry
  readonly resolveLocale?: (request: Request) => string | Promise<string>
  readonly resolveServices?: (request: Request) => TServices | Promise<TServices>
  readonly resolveTenant?: (request: Request) => Promise<TTenant> | TTenant
  readonly execute?: (input: NextPanelOperationInput<TActor, TServices, TTenant, TPayload>) => NextPanelOperationResult<TResult> | Promise<NextPanelOperationResult<TResult>>
}

export function defineNextPanelsRuntime<
  TActor extends object,
  TServices,
  TTenant,
  TPayload extends JsonObject = JsonObject,
  TResult extends JsonValue = JsonValue,
>(runtime: NextPanelsRuntime<TActor, TServices, TTenant, TPayload, TResult>): NextPanelsRuntime<TActor, TServices, TTenant, TPayload, TResult> {
  return runtime
}

export interface CreatePanelPageOptions<TRuntime = NextPanelsRuntime> {
  readonly client?: ComponentType<Pick<NextPanelClientProps, 'payload'>>
  readonly loginPath?: string
  readonly panelId: string
  readonly runtime?: TRuntime
}

export interface CreatePanelOperationRouteOptions<TRuntime = NextPanelsRuntime> {
  readonly panelIds: readonly string[]
  readonly runtime?: TRuntime
}

export type CreatePanelAuthRouteOptions<TRuntime = NextPanelsRuntime> = CreatePanelOperationRouteOptions<TRuntime>

export type CreatePanelTenantRouteOptions<TRuntime = NextPanelsRuntime> = CreatePanelOperationRouteOptions<TRuntime>

export type NextRouteHandler = (
  request: Request,
  context: NextPanelRouteContext,
) => Promise<Response>

export interface NextPanelPageProps {
  readonly params: Promise<{ readonly panelsPath?: readonly string[] }>
  readonly searchParams?: Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
}

export interface NextPanelPagePayload {
  readonly bootstrap: PanelShellBootstrap
  readonly effects: readonly Effect[]
  readonly page: ResolvedPageData<JsonObject>
  readonly path: string
  readonly widgets: {
    readonly footer: readonly ResolvedWidget<JsonValue>[]
    readonly header: readonly ResolvedWidget<JsonValue>[]
  }
}

export interface NextPanelRouteContext {
  readonly params: Promise<{ readonly operation: string, readonly panelId: string }>
}

export interface NextPanelClientProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly payload: NextPanelPagePayload
  readonly registry?: ComponentRegistry
  readonly tenantTransport?: PanelTenantSwitcherTransport
}
