import type { createSvelteKitHoloHelpers } from '@holo-js/adapter-sveltekit'
import type {
  Effect,
  ClientNotificationRealtime,
  JsonObject,
  JsonValue,
  PanelAuthenticatedScope as CorePanelAuthenticatedScope,
  PanelOperation as CorePanelOperation,
  ResolvedPageData,
  SvelteComponentRegistry,
  CompiledPanelDefinition,
} from '@holo-js/panels-svelte'
import type { PanelRuntime, ResolvedWidget } from '@holo-js/panels-svelte/server'

export type PanelOperation = CorePanelOperation
export type SvelteKitPanelRegistryValue = object | { readonly compile: () => object }
export type SvelteKitPanelServerRegistry = Readonly<Record<string, () => Promise<SvelteKitPanelRegistryValue>>>
export type PanelBootstrapData = Awaited<ReturnType<PanelRuntime<unknown>['bootstrap']>>[number]
export type PanelResolvedPageData = ResolvedPageData<JsonObject>

export interface PanelPageData {
  readonly effects: readonly Effect[]
  readonly panel: PanelBootstrapData
  readonly page: PanelResolvedPageData
  readonly widgets: {
    readonly footer: readonly ResolvedWidget<JsonValue>[]
    readonly header: readonly ResolvedWidget<JsonValue>[]
  }
}

export type PanelAuthenticatedScope<TActor = unknown> = CorePanelAuthenticatedScope<TActor>

export interface PanelRuntimeLike<TActor = unknown> {
  bootstrap(panelIds: readonly string[], signal: AbortSignal): Promise<readonly PanelBootstrapData[]>
  execute<TResult>(
    panelId: string,
    operation: PanelOperation,
    signal: AbortSignal,
    handler: (scope: PanelAuthenticatedScope<TActor>) => TResult | Promise<TResult>,
  ): Promise<TResult>
}

export interface SvelteKitPanelEvent {
  readonly cookies: {
    get(name: string): string | undefined
    set(name: string, value: string, options: { readonly path: string, readonly domain?: string, readonly maxAge?: number, readonly expires?: Date, readonly secure?: boolean, readonly httpOnly?: boolean, readonly sameSite?: 'lax' | 'strict' | 'none', readonly partitioned?: boolean }): void
  }
  readonly locals: Record<string, unknown> & { panels?: SvelteKitPanelRegistry }
  readonly params: Readonly<Record<string, string | undefined>>
  readonly request: Request
  readonly url: URL
}

export interface PanelPageResolutionInput<TActor = unknown, TTenant = unknown> {
  readonly event: SvelteKitPanelEvent
  readonly holo: ReturnType<typeof createSvelteKitHoloHelpers>
  readonly panelId: string
  readonly parameters: Readonly<Record<string, string>>
  readonly path: string
  readonly scope: PanelAuthenticatedScope<TActor>
  readonly tenant: TTenant | undefined
}

export interface PanelOperationResult {
  readonly data: JsonValue
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface PanelOperationInput<TActor = unknown, TTenant = unknown> {
  readonly event: SvelteKitPanelEvent
  readonly holo: ReturnType<typeof createSvelteKitHoloHelpers>
  readonly idempotencyKey?: string
  readonly operation: PanelOperation
  readonly panelId: string
  readonly payload: JsonValue
  readonly scope: PanelAuthenticatedScope<TActor>
  readonly tenant: TTenant | undefined
}

export interface SvelteKitPanelRegistry<TActor = unknown, TTenant = unknown> {
  readonly operations?: Readonly<Partial<Record<PanelOperation, (input: PanelOperationInput<TActor, TTenant>) => PanelOperationResult | Promise<PanelOperationResult>>>>
  readonly panels?: Readonly<Record<string, CompiledPanelDefinition<TActor>>>
  readonly resolvePage: (input: PanelPageResolutionInput<TActor, TTenant>) => PanelResolvedPageData | Promise<PanelResolvedPageData>
  readonly resolveWidgets?: (input: PanelPageResolutionInput<TActor, TTenant> & { readonly page: PanelResolvedPageData }) => PanelPageData['widgets'] | Promise<PanelPageData['widgets']>
  readonly resolveTenant?: (event: SvelteKitPanelEvent) => Promise<TTenant> | TTenant
  readonly runtime: PanelRuntimeLike<TActor>
}

export function defineSvelteKitPanelRegistry<TActor, TTenant>(
  runtime: PanelRuntimeLike<TActor>,
  registry: Omit<SvelteKitPanelRegistry<TActor, TTenant>, 'runtime'>,
): SvelteKitPanelRegistry<TActor, TTenant> {
  return Object.freeze({ ...registry, runtime })
}

export interface CreatePanelPageLoadOptions<TActor = unknown, TTenant = unknown> {
  readonly panelId: string
  readonly registry?: SvelteKitPanelRegistry<TActor, TTenant>
}

export interface CreatePanelOperationHandlerOptions<TActor = unknown, TTenant = unknown> {
  readonly panelIds: readonly string[]
  readonly registry?: SvelteKitPanelRegistry<TActor, TTenant>
}

export interface CreateSvelteKitPanelRouteOptions<TActor = unknown, TTenant = unknown> {
  readonly panelId: string
  readonly registry?: SvelteKitPanelRegistry<TActor, TTenant>
}

export interface PanelPageProps {
  readonly data: PanelPageData
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly registry?: SvelteComponentRegistry
}

export interface SvelteKitPanelOperationHandler {
  readonly GET: (event: SvelteKitPanelEvent) => Promise<Response>
  readonly POST: (event: SvelteKitPanelEvent) => Promise<Response>
}

export interface SvelteKitPanelRouteHandler extends SvelteKitPanelOperationHandler {
  readonly DELETE: (event: SvelteKitPanelEvent) => Promise<Response>
  readonly PATCH: (event: SvelteKitPanelEvent) => Promise<Response>
  readonly PUT: (event: SvelteKitPanelEvent) => Promise<Response>
}

export type SvelteKitPanelTenantHandler = SvelteKitPanelOperationHandler
