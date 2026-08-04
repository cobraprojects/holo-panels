import type { H3Event } from 'h3'
import type { Component } from 'vue'
import type { ClientNotificationRealtime, Effect, JsonObject, JsonValue } from '@holo-js/panels-vue'
import type { holo as nuxtHolo } from '@holo-js/adapter-nuxt/runtime'

export type NuxtPanelJsonPrimitive = boolean | number | string | null
export type NuxtPanelJsonValue = JsonValue
export type NuxtPanelJsonObject = JsonObject

export type NuxtPanelOperation = 'action' | 'bootstrap' | 'form-submit' | 'notification' | 'options' | 'page-data' | 'resolver' | 'table-data' | 'upload'

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

export interface NuxtPanelManifest {
  readonly branding: { readonly favicon: string | null, readonly logo: string | null, readonly name: string }
  readonly databaseNotifications: {
    readonly placement: 'sidebar' | 'topbar'
    readonly polling: false | number
    readonly realtime: boolean
  } | null
  readonly default: boolean
  readonly id: string
  readonly navigation: readonly NuxtPanelNavigationItem[]
  readonly navigationMode: 'sidebar' | 'topbar'
  readonly path: string
  readonly sidebarCollapsible: boolean
  readonly theme: NuxtPanelJsonObject
  readonly userMenu: readonly { readonly id: string, readonly label: string, readonly path: string }[]
}

export interface NuxtPanelPageManifest {
  readonly body: { readonly component: string, readonly properties: NuxtPanelJsonObject } | null
  readonly id: string
  readonly pageType: 'create' | 'custom' | 'edit' | 'list' | 'related-record' | 'singular' | 'view'
  readonly path: string
  readonly schemaId: string | null
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

export interface NuxtPanelBootstrap {
  readonly actor: NuxtPanelJsonObject
  readonly manifest: NuxtPanelManifest
  readonly notifications: { readonly realtimeChannel: string | null } | null
  readonly provider: string | null
}

export interface NuxtPanelPage {
  readonly bootstrap: NuxtPanelBootstrap
  readonly effects?: readonly Effect[]
  readonly page: NuxtPanelPageData
  readonly path: string
}

export interface UsePanelPageOptions {
  readonly load?: (request: { readonly panelId: string, readonly path: string, readonly signal: AbortSignal }) => Promise<NuxtPanelPage>
  readonly panelId: string
  readonly path?: string
}

export interface NuxtPanelOperationContext {
  readonly actor: unknown
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
}

export interface NuxtPanelOperationResult {
  readonly data: unknown
  readonly effects?: readonly Effect[]
  readonly status?: number
}

export interface CreatePanelOperationHandlerOptions {
  readonly panelIds: readonly string[]
  readonly runtime: NuxtPanelRuntime
}

export interface NuxtPanelRuntimePanel {
  readonly access: (context: { readonly actor: unknown, readonly operation: NuxtPanelOperation, readonly panelId: string, readonly signal: AbortSignal }) => boolean | Promise<boolean>
  readonly guard: string
}

export interface NuxtPanelRuntime {
  readonly execute: (context: NuxtPanelOperationContext) => NuxtPanelOperationResult | Promise<NuxtPanelOperationResult>
  readonly panels: Readonly<Record<string, NuxtPanelRuntimePanel>>
}

export interface PanelPageProps {
  readonly notificationRealtime?: (channel: string) => ClientNotificationRealtime
  readonly page: NuxtPanelPage
  readonly resolveResource?: (page: NuxtPanelPageData) => Component | Promise<Component>
}
