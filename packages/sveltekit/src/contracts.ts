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
import type { PanelRuntime } from '@holo-js/panels-svelte/server'

export type PanelOperation = CorePanelOperation
export type PanelBootstrapData = Awaited<ReturnType<PanelRuntime<unknown>['bootstrap']>>[number]
export type PanelResolvedPageData = ResolvedPageData<JsonObject>

export interface PanelPageData {
  readonly effects: readonly Effect[]
  readonly panel: PanelBootstrapData
  readonly page: PanelResolvedPageData
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

export interface PanelPageResolutionInput<TActor = unknown> {
  readonly event: SvelteKitPanelEvent
  readonly holo: ReturnType<typeof createSvelteKitHoloHelpers>
  readonly panelId: string
  readonly parameters: Readonly<Record<string, string>>
  readonly path: string
  readonly scope: PanelAuthenticatedScope<TActor>
}

export interface PanelOperationResult {
  readonly data: JsonValue
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface PanelOperationInput<TActor = unknown> {
  readonly event: SvelteKitPanelEvent
  readonly holo: ReturnType<typeof createSvelteKitHoloHelpers>
  readonly idempotencyKey?: string
  readonly operation: PanelOperation
  readonly panelId: string
  readonly payload: JsonValue
  readonly scope: PanelAuthenticatedScope<TActor>
}

export interface SvelteKitPanelRegistry<TActor = unknown> {
  readonly operations?: Readonly<Partial<Record<PanelOperation, (input: PanelOperationInput<TActor>) => PanelOperationResult | Promise<PanelOperationResult>>>>
  readonly panels?: Readonly<Record<string, CompiledPanelDefinition<never>>>
  readonly resolvePage: (input: PanelPageResolutionInput<TActor>) => PanelResolvedPageData | Promise<PanelResolvedPageData>
  readonly resolveTenant?: (event: SvelteKitPanelEvent) => unknown | Promise<unknown>
  readonly runtime: PanelRuntimeLike<TActor>
}

export interface CreatePanelPageLoadOptions<TActor = unknown> {
  readonly loginPath?: string
  readonly panelId: string
  readonly registry?: SvelteKitPanelRegistry<TActor>
}

export interface CreatePanelOperationHandlerOptions<TActor = unknown> {
  readonly panelIds: readonly string[]
  readonly registry?: SvelteKitPanelRegistry<TActor>
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

export type SvelteKitPanelTenantHandler = SvelteKitPanelOperationHandler
