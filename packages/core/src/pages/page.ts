import { ConstructionBuilder } from '../builders/construction-builder'
import { DISCOVERY_MARKER, type DiscoverableBuilder, type DiscoverableDefinition } from '../discovery/types'
import type { JsonObject } from '../protocol/json'
import type { ExtensionTypeId } from '../plugins/type-id'
import type { OptionalRuntimeTypeValue, RuntimeTypeSource } from '../inference/type-source'
import { toJsonValue } from '../protocol/serialization'
import type { CompiledSchema } from '../schemas/contracts'
import type { RenderSlotReference } from '../schemas/contracts'
import type { ResourceCompositionTypes } from '../resources/contracts'
import { appendScopedRenderSlot, type ScopedRenderSlots } from '../panels/render-slots'
import type {
  CompiledPageDefinition,
  PageBreadcrumb,
  PageComponentBody,
  PageContext,
  PageLayoutSlot,
  PageManifest,
  PageNavigation,
  PageNavigationInput,
  PageRendererManifest,
  PageResolvable,
  PageServerHandles,
  PageType,
} from './contracts'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const ROUTE_SEGMENT = /^:[a-z][a-zA-Z0-9]*$|^[a-z0-9][a-z0-9-]*$/u

interface PageState<TData extends JsonObject, TActor, TTenant, TServices> {
  authorize: PageServerHandles<TData, TActor, TTenant, TServices>['authorize']
  body: PageComponentBody | null
  breadcrumbs?: PageResolvable<PageContext<TActor, TTenant, TServices>, readonly PageBreadcrumb[]>
  footerActions: string[]
  footerWidgets: string[]
  headerActions: string[]
  headerWidgets: string[]
  heading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>
  load?: PageServerHandles<TData, TActor, TTenant, TServices>['load']
  navigation: PageNavigation | null
  path: string
  renderer: PageRendererManifest | null
  schema?: PageResolvable<
    PageContext<TActor, TTenant, TServices>,
    CompiledSchema<Readonly<Record<string, unknown>>, PageContext<TActor, TTenant, TServices>> | null
  >
  schemaId: string | null
  slots: ScopedRenderSlots<PageLayoutSlot>
  subheading?: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>
  title?: PageResolvable<PageContext<TActor, TTenant, TServices>, string>
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} requires a stable identifier`)
}

function normalizePath(path: string): string {
  const value = `/${path.trim().replace(/^\/+|\/+$/gu, '')}`
  if (value === '/') return value
  if (value.includes('//') || value.includes('?') || value.includes('#')) throw new Error('Page paths must contain route segments only')
  if (!value.slice(1).split('/').every(segment => ROUTE_SEGMENT.test(segment))) {
    throw new Error('Page paths require static or named parameter segments')
  }
  return value
}

function identifiers(values: readonly string[], label: string): string[] {
  const result = [...values]
  for (const value of result) assertIdentifier(value, label)
  if (new Set(result).size !== result.length) throw new Error(`${label} cannot contain duplicates`)
  return result
}

export class PageBuilder<
  TData extends JsonObject = JsonObject,
  TActor = unknown,
  TTenant = unknown,
  TServices = unknown,
> extends ConstructionBuilder<PageState<TData, TActor, TTenant, TServices>, CompiledPageDefinition<TData, TActor, TTenant, TServices>> implements DiscoverableBuilder<'page'> {
  declare readonly resourceCompositionTypes: ResourceCompositionTypes<unknown, TActor, TTenant, TServices>
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'page' as const

  constructor(
    readonly id: string,
    readonly pageType: PageType,
    state?: PageState<TData, TActor, TTenant, TServices>,
  ) {
    assertIdentifier(id, 'Pages')
    super(state ?? {
      authorize: () => true,
      body: null,
      footerActions: [],
      footerWidgets: [],
      headerActions: [],
      headerWidgets: [],
      navigation: null,
      path: `/${id}`,
      renderer: null,
      schemaId: null,
      slots: {},
    })
  }

  configured(
    id: string,
    configure: (page: PageBuilder<TData, TActor, TTenant, TServices>) => PageBuilder<TData, TActor, TTenant, TServices>,
  ): PageBuilder<TData, TActor, TTenant, TServices> {
    assertIdentifier(id, 'Configured page variants')
    const state = this.readState()
    const variant = new PageBuilder<TData, TActor, TTenant, TServices>(id, this.pageType, {
      ...state,
      footerActions: [...state.footerActions],
      footerWidgets: [...state.footerWidgets],
      headerActions: [...state.headerActions],
      headerWidgets: [...state.headerWidgets],
      slots: Object.freeze(Object.fromEntries(Object.entries(state.slots).map(([slot, references]) => [slot, Object.freeze([...(references ?? [])])]))),
    })
    const configured = configure(variant)
    if (configured.id !== id) throw new Error('Configured page callbacks must return the configured variant')
    return configured
  }

  path(value: string): this {
    return this.writeState('path', normalizePath(value))
  }

  authorize(resolver: PageServerHandles<TData, TActor, TTenant, TServices>['authorize']): this {
    return this.writeState('authorize', resolver)
  }

  loader(loader: PageServerHandles<TData, TActor, TTenant, TServices>['load']): this {
    return this.writeState('load', loader)
  }

  title(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string>): this {
    return this.writeState('title', value)
  }

  heading(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>): this {
    return this.writeState('heading', value)
  }

  subheading(value: PageResolvable<PageContext<TActor, TTenant, TServices>, string | null>): this {
    return this.writeState('subheading', value)
  }

  breadcrumbs(value: PageResolvable<PageContext<TActor, TTenant, TServices>, readonly PageBreadcrumb[]>): this {
    return this.writeState('breadcrumbs', value)
  }

  headerActions(...actionIds: readonly string[]): this {
    return this.writeState('headerActions', identifiers(actionIds, 'Header actions'))
  }

  footerActions(...actionIds: readonly string[]): this {
    return this.writeState('footerActions', identifiers(actionIds, 'Footer actions'))
  }

  headerWidgets(...widgetIds: readonly string[]): this {
    return this.writeState('headerWidgets', identifiers(widgetIds, 'Header widgets'))
  }

  footerWidgets(...widgetIds: readonly string[]): this {
    return this.writeState('footerWidgets', identifiers(widgetIds, 'Footer widgets'))
  }

  schema(
    id: string,
    value: PageResolvable<
      PageContext<TActor, TTenant, TServices>,
      CompiledSchema<Readonly<Record<string, unknown>>, PageContext<TActor, TTenant, TServices>> | null
    >,
  ): this {
    assertIdentifier(id, 'Page schemas')
    this.writeState('schemaId', id)
    return this.writeState('schema', value)
  }

  body(component: string, properties: JsonObject = {}): this {
    assertIdentifier(component, 'Custom page components')
    const serialized = toJsonValue({ component, properties })
    if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') throw new TypeError('Page component bodies must be JSON-safe')
    return this.writeState('body', { component, properties })
  }

  renderer(type: ExtensionTypeId<'page'>, properties: JsonObject = {}): this {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*:page:[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(type)) {
      throw new Error('Page renderer type IDs must use namespace:page:name')
    }
    const serialized = toJsonValue(properties)
    if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
      throw new TypeError('Page renderer properties must be JSON-safe')
    }
    return this.writeState('renderer', { properties: serialized, type })
  }

  slot(slot: PageLayoutSlot, reference: string | RenderSlotReference): this {
    return this.writeState('slots', appendScopedRenderSlot(this.readState().slots, slot, reference, 'page'))
  }

  navigation(value: PageNavigationInput): this {
    if (!value.label.trim()) throw new Error('Page navigation labels cannot be empty')
    return this.writeState('navigation', {
      badge: value.badge ?? null,
      group: value.group ?? null,
      icon: value.icon ?? null,
      label: value.label,
      parent: value.parent ?? null,
      sort: value.sort ?? 0,
    })
  }

  compileDiscoveryDefinition(): DiscoverableDefinition<'page'> {
    const definition = this.compile()
    return Object.freeze({
      client: definition.manifest,
      discoveryMarker: this.discoveryMarker,
      id: this.id,
      kind: this.kind,
      navigationKeys: definition.manifest.navigation ? [this.id] : [],
      ...(definition.manifest.renderer ? { componentKeys: [definition.manifest.renderer.type] } : {}),
      route: definition.manifest.path,
    })
  }

  protected createDefinition(state: Readonly<PageState<TData, TActor, TTenant, TServices>>): CompiledPageDefinition<TData, TActor, TTenant, TServices> {
    const manifest: PageManifest = {
      actions: { footer: state.footerActions, header: state.headerActions },
      body: state.body,
      id: this.id,
      navigation: state.navigation,
      pageType: this.pageType,
      path: state.path,
      renderer: state.renderer,
      schemaId: state.schemaId,
      slots: state.slots,
      widgets: { footer: state.footerWidgets, header: state.headerWidgets },
    }
    toJsonValue(manifest)
    return {
      kind: 'page',
      manifest,
      server: {
        authorize: state.authorize,
        ...(state.breadcrumbs ? { breadcrumbs: state.breadcrumbs } : {}),
        ...(state.heading !== undefined ? { heading: state.heading } : {}),
        ...(state.load ? { load: state.load } : {}),
        ...(state.schema ? { schema: state.schema } : {}),
        ...(state.subheading !== undefined ? { subheading: state.subheading } : {}),
        ...(state.title !== undefined ? { title: state.title } : {}),
      },
    }
  }
}

export interface PageTypeSources<
  TData extends JsonObject,
  TActorSource extends RuntimeTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
> {
  readonly actor?: TActorSource
  readonly load: (
    context: PageContext<
      OptionalRuntimeTypeValue<TActorSource>,
      OptionalRuntimeTypeValue<TTenantSource>,
      OptionalRuntimeTypeValue<TServicesSource>
    >,
  ) => TData | Promise<TData>
  readonly services?: TServicesSource
  readonly tenant?: TTenantSource
}

type PageFromSources<
  TData extends JsonObject,
  TActorSource extends RuntimeTypeSource | undefined,
  TTenantSource extends RuntimeTypeSource | undefined,
  TServicesSource extends RuntimeTypeSource | undefined,
> = PageBuilder<
  TData,
  OptionalRuntimeTypeValue<TActorSource>,
  OptionalRuntimeTypeValue<TTenantSource>,
  OptionalRuntimeTypeValue<TServicesSource>
>

export function definePage<
  TData extends JsonObject,
  TActorSource extends RuntimeTypeSource | undefined = undefined,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(id: string, sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>, type?: PageType): PageFromSources<TData, TActorSource, TTenantSource, TServicesSource>
export function definePage(id: string, type?: PageType): PageBuilder<JsonObject, unknown, unknown, unknown>
export function definePage(id: string, sourcesOrType: PageTypeSources<JsonObject> | PageType = 'custom', pageType: PageType = 'custom'): PageBuilder<JsonObject, unknown, unknown, unknown> {
  const type = typeof sourcesOrType === 'string' ? sourcesOrType : pageType
  const page = new PageBuilder<JsonObject, unknown, unknown, unknown>(id, type)
  return typeof sourcesOrType === 'string' ? page : page.loader(sourcesOrType.load)
}

type PageFactory = {
  <TData extends JsonObject, TActorSource extends RuntimeTypeSource | undefined = undefined, TTenantSource extends RuntimeTypeSource | undefined = undefined, TServicesSource extends RuntimeTypeSource | undefined = undefined>(
    id: string,
    sources: PageTypeSources<TData, TActorSource, TTenantSource, TServicesSource>,
  ): PageFromSources<TData, TActorSource, TTenantSource, TServicesSource>
  (id: string): PageBuilder<JsonObject, unknown, unknown, unknown>
}

function pageFactory(type: PageType): PageFactory {
  function create<
    TData extends JsonObject = JsonObject,
    TActor = unknown,
    TTenant = unknown,
    TServices = unknown,
  >(
    id: string,
    options?: { readonly load: (context: PageContext<TActor, TTenant, TServices>) => TData | Promise<TData> },
  ): PageBuilder<TData, TActor, TTenant, TServices> {
    const page = new PageBuilder<TData, TActor, TTenant, TServices>(id, type)
    return options ? page.loader(options.load) : page
  }
  return create
}

export const defineListPage = pageFactory('list')
export const defineCreatePage = pageFactory('create')
export const defineEditPage = pageFactory('edit')
export const defineViewPage = pageFactory('view')
export const defineCustomPage = pageFactory('custom')
export const defineSingularPage = pageFactory('singular')
export const defineRelatedRecordPage = pageFactory('related-record')
