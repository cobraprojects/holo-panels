import type { H3Event } from 'h3'
import type { Component } from 'vue'
import type { ClientNotificationRealtime, ComponentRegistry, Effect, JsonObject, JsonValue, PanelShellBootstrap } from '@holo-js/panels-vue'
import type { holo as nuxtHolo } from '@holo-js/adapter-nuxt/runtime'
import type { CompiledPanelDefinition } from '@holo-js/panels-vue'
import type { ResolvedWidget } from '@holo-js/panels-vue/server'

export type NuxtPanelRegistryValue = object | { readonly compile: () => object }
export type NuxtPanelServerRegistry = Readonly<Record<string, () => Promise<NuxtPanelRegistryValue>>>

export type NuxtPanelJsonPrimitive = boolean | number | string | null
export type NuxtPanelJsonValue = JsonValue
export type NuxtPanelJsonObject = JsonObject

export type NuxtPanelOperation = 'action' | 'bootstrap' | 'form-submit' | 'global-search' | 'notification' | 'options' | 'page-data' | 'resolver' | 'table-data' | 'upload'

export interface NuxtPanelNavigationItem {
  readonly badge: string | null
  readonly group: string | null
  readonly icon: string | null
  readonly id: string
  readonly label: string
  readonly parent: string | null
  readonly path: string
  readonly sort: number
}

export type NuxtPanelManifest = PanelShellBootstrap['manifest']

export interface NuxtPanelPageManifest {
  readonly body: { readonly component: string, readonly properties: NuxtPanelJsonObject } | null
  readonly id: string
  readonly pageType: 'create' | 'custom' | 'edit' | 'list' | 'manage' | 'related-record' | 'singular' | 'view'
  readonly path: string
  readonly schemaId: string | null
  readonly widgets: { readonly footer: readonly string[], readonly header: readonly string[] }
}

export interface NuxtPanelPageData {
  readonly breadcrumbs: readonly { readonly label: string, readonly path: string }[]
  readonly data: NuxtPanelJsonObject
  readonly heading: string | null
  readonly manifest: NuxtPanelPageManifest
  readonly schema: NuxtPanelJsonObject | null
  readonly subheading: string | null
  readonly title: string
}

export type NuxtPanelBootstrap = PanelShellBootstrap

export interface NuxtPanelPage {
  readonly bootstrap: NuxtPanelBootstrap
  readonly effects?: readonly Effect[]
  readonly page: NuxtPanelPageData
  readonly path: string
  readonly widgets: {
    readonly footer: readonly ResolvedWidget<JsonValue>[]
    readonly header: readonly ResolvedWidget<JsonValue>[]
  }
}

export interface UsePanelPageOptions {
  readonly load?: (request: { readonly panelId: string, readonly path: string, readonly signal: AbortSignal }) => Promise<NuxtPanelPage>
  readonly panelId: string
  readonly path?: string
}

export interface NuxtPanelOperationContext<
  TActor = unknown,
  TTenant = unknown,
> {
  readonly actor: TActor
  readonly event: H3Event
  readonly getApp: () => ReturnType<typeof nuxtHolo.getApp>
  readonly getAuth: () => ReturnType<typeof nuxtHolo.getAuth>
  readonly input: NuxtPanelJsonObject
  readonly idempotencyKey?: string
  readonly operation: NuxtPanelOperation
  readonly panelId: string
  readonly provider: string | null
  readonly requestId: string
  readonly signal: AbortSignal
  readonly tenant: TTenant | undefined
}

export interface NuxtPanelOperationResult<TResult = unknown> {
  readonly data: TResult
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface CreatePanelOperationHandlerOptions<
  TActor = unknown,
  TTenant = unknown,
  TResult = unknown,
> {
  readonly panelIds: readonly string[]
  readonly runtime: NuxtPanelRuntime<TActor, TTenant, TResult>
}

export interface CreateNuxtPanelRouteHandlerOptions<
  TActor = unknown,
  TTenant = unknown,
  TResult = unknown,
> {
  readonly panelId: string
  readonly runtime: NuxtPanelRuntime<TActor, TTenant, TResult>
}

export interface NuxtPanelRuntimePanel<TActor = unknown> {
  readonly access: (context: { readonly actor: TActor, readonly operation: NuxtPanelOperation, readonly panelId: string, readonly signal: AbortSignal }) => boolean | Promise<boolean>
  readonly definition?: CompiledPanelDefinition<TActor>
  readonly guard: string
}

export interface NuxtPanelRuntime<
  TActor = unknown,
  TTenant = unknown,
  TResult = unknown,
> {
  readonly execute: (context: NuxtPanelOperationContext<TActor, TTenant>) => NuxtPanelOperationResult<TResult> | Promise<NuxtPanelOperationResult<TResult>>
  readonly panels: Readonly<Record<string, NuxtPanelRuntimePanel<TActor>>>
  readonly registry?: NuxtPanelServerRegistry
  readonly resolveTenant?: (event: H3Event) => Promise<TTenant> | TTenant
}

export function defineNuxtPanelRuntime<TActor, TTenant, TResult = unknown>(
  runtime: NuxtPanelRuntime<TActor, TTenant, TResult>,
): NuxtPanelRuntime<TActor, TTenant, TResult> {
  return runtime
}

export interface PanelPageProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly page: NuxtPanelPage
  readonly registry?: ComponentRegistry
  readonly resolveResource?: (page: NuxtPanelPageData) => Component | Promise<Component>
}
