import type { JsonObject } from '../protocol/json'
import type { ExtensionTypeId } from '../plugins/type-id'
import type { CompiledSchema, SchemaManifest } from '../schemas/contracts'
import type { ScopedRenderSlots } from '../panels/render-slots'

export type PageType = 'create' | 'custom' | 'edit' | 'list' | 'related-record' | 'singular' | 'view'
export type PageLayoutSlot = 'above-content' | 'after-content' | 'before-content' | 'below-content'

export interface PageContext<TActor, TTenant, TServices> {
  readonly actor: TActor
  readonly locale: string
  readonly panelId: string
  readonly parameters: Readonly<Record<string, string>>
  readonly services: TServices
  readonly signal: AbortSignal
  readonly strictAuthorization?: boolean
  readonly tenant: TTenant
}

export type PageResolvable<TContext, TValue> = TValue | ((context: TContext) => TValue | Promise<TValue>)

export interface PageBreadcrumb {
  readonly label: string
  readonly path: string
}

export interface PageNavigation {
  readonly badge: string | null
  readonly group: string | null
  readonly icon: string | null
  readonly label: string
  readonly parent: string | null
  readonly sort: number
}

export interface PageNavigationInput {
  readonly badge?: string | null
  readonly group?: string | null
  readonly icon?: string | null
  readonly label: string
  readonly parent?: string | null
  readonly sort?: number
}

export interface PageComponentBody {
  readonly component: string
  readonly properties: JsonObject
}

export interface PageRendererManifest extends JsonObject {
  readonly properties: JsonObject
  readonly type: ExtensionTypeId<'page'>
}

export interface PageManifest {
  readonly actions: { readonly footer: readonly string[], readonly header: readonly string[] }
  readonly body: PageComponentBody | null
  readonly id: string
  readonly navigation: PageNavigation | null
  readonly pageType: PageType
  readonly path: string
  readonly renderer: PageRendererManifest | null
  readonly schemaId: string | null
  readonly slots: ScopedRenderSlots<PageLayoutSlot>
  readonly widgets: { readonly footer: readonly string[], readonly header: readonly string[] }
}

export interface PageServerHandles<TData extends JsonObject, TActor, TTenant, TServices> {
  readonly authorize: (context: PageContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>
  readonly breadcrumbs?: PageResolvable<PageContext<TActor, TTenant, TServices>, readonly PageBreadcrumb[]>
  readonly heading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>
  readonly load?: (context: PageContext<TActor, TTenant, TServices>) => TData | Promise<TData>
  readonly schema?: PageResolvable<
    PageContext<TActor, TTenant, TServices>,
    CompiledSchema<Readonly<Record<string, unknown>>, PageContext<TActor, TTenant, TServices>> | null
  >
  readonly subheading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>
  readonly title?: PageResolvable<PageContext<TActor, TTenant, TServices>, string>
}

export interface CompiledPageDefinition<TData extends JsonObject, TActor, TTenant, TServices> {
  readonly kind: 'page'
  readonly manifest: PageManifest
  readonly server: PageServerHandles<TData, TActor, TTenant, TServices>
}

export interface ResolvedPageData<TData extends JsonObject> {
  readonly breadcrumbs: readonly PageBreadcrumb[]
  readonly data: TData
  readonly heading: string | null
  readonly manifest: PageManifest
  readonly schema: SchemaManifest<Readonly<Record<string, unknown>>> | null
  readonly subheading: string | null
  readonly title: string
}
