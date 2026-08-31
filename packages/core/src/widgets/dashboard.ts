import { ConstructionBuilder } from '../builders/construction-builder'
import { DISCOVERY_MARKER, type DiscoverableBuilder, type DiscoverableDefinition } from '../discovery/types'
import { toJsonValue } from '../protocol/serialization'
import { dashboardFilterManifest, type DashboardFilterSchema } from './filter-form'
import type {
  CompiledDashboardDefinition,
  DashboardContext,
  DashboardManifest,
  DashboardNavigation,
  ResourceWidgetContext,
  WidgetResourcePlacement,
} from './contracts'
import type { TableQueryState } from '../tables/query/contracts'
import type { ContextTypeSources, OptionalRuntimeTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'

const IDENTIFIER = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u
const PATH = /^\/(?:[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)?$/u

interface DashboardState<TActor, TTenant, TServices> {
  authorize: (context: DashboardContext<TActor, TTenant, TServices>) => boolean | Promise<boolean>
  default: boolean
  filters: DashboardFilterSchema | null
  persistFilters: boolean
  navigation: DashboardNavigation
  path: string
  widgets: string[]
}

function assertIdentifier(value: string, label: string): void {
  if (!IDENTIFIER.test(value)) throw new Error(`${label} requires a stable identifier`)
}

export class DashboardBuilder<TActor = unknown, TTenant = unknown, TServices = unknown> extends ConstructionBuilder<DashboardState<TActor, TTenant, TServices>, CompiledDashboardDefinition<TActor, TTenant, TServices>> implements DiscoverableBuilder<'page'> {
  readonly discoveryMarker = DISCOVERY_MARKER
  readonly kind = 'page' as const

  constructor(readonly id: string) {
    assertIdentifier(id, 'Dashboards')
    super({
      authorize: () => true,
      default: false,
      filters: null,
      persistFilters: false,
      navigation: { icon: null, label: id, sort: 0 },
      path: `/${id}`,
      widgets: [],
    })
  }

  path(value: string): this {
    if (!PATH.test(value)) throw new Error('Dashboard paths must be normalized static paths')
    return this.writeState('path', value)
  }

  filtersForm<TSchema extends DashboardFilterSchema>(schema: TSchema): this {
    return this.writeState('filters', schema)
  }

  persistFiltersInSession(enabled = true): this {
    return this.writeState('persistFilters', enabled)
  }

  default(value = true): this {
    return this.writeState('default', value)
  }

  navigation(label: string, options: { readonly icon?: string | null, readonly sort?: number } = {}): this {
    if (!label.trim()) throw new Error('Dashboard navigation labels cannot be empty')
    const sort = options.sort ?? 0
    if (!Number.isFinite(sort)) throw new Error('Dashboard navigation sort must be finite')
    return this.writeState('navigation', { icon: options.icon ?? null, label: label.trim(), sort })
  }

  widgets(...ids: readonly string[]): this {
    for (const id of ids) assertIdentifier(id, 'Dashboard widgets')
    if (new Set(ids).size !== ids.length) throw new Error('Dashboard widgets cannot contain duplicates')
    return this.writeState('widgets', [...ids])
  }

  authorize(resolver: DashboardState<TActor, TTenant, TServices>['authorize']): this {
    return this.writeState('authorize', resolver)
  }

  compileDiscoveryDefinition(): DiscoverableDefinition<'page'> {
    const definition = this.compile()
    return Object.freeze({
      client: definition.manifest,
      discoveryMarker: this.discoveryMarker,
      id: this.id,
      kind: this.kind,
      navigationKeys: [this.id],
      route: definition.manifest.path,
    })
  }

  protected createDefinition(state: Readonly<DashboardState<TActor, TTenant, TServices>>): CompiledDashboardDefinition<TActor, TTenant, TServices> {
    const manifest: DashboardManifest = {
      default: state.default,
      filters: state.filters ? dashboardFilterManifest(state.filters) : null,
      persistFilters: state.persistFilters,
      id: this.id,
      navigation: state.navigation,
      path: state.path,
      widgets: state.widgets,
    }
    toJsonValue(manifest)
    return { kind: 'dashboard', manifest, server: { authorize: state.authorize, filters: state.filters } }
  }
}

export function defineDashboard<
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(
  id: string,
  sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource>,
): DashboardBuilder<RuntimeTypeValue<TActorSource>, OptionalRuntimeTypeValue<TTenantSource>, OptionalRuntimeTypeValue<TServicesSource>>
export function defineDashboard(id: string): DashboardBuilder<unknown, unknown, unknown>
export function defineDashboard<TActor = unknown, TTenant = unknown, TServices = unknown>(id: string): DashboardBuilder<TActor, TTenant, TServices> {
  return new DashboardBuilder<TActor, TTenant, TServices>(id)
}

export async function selectDefaultDashboard<TActor, TTenant, TServices>(
  definitions: readonly CompiledDashboardDefinition<TActor, TTenant, TServices>[],
  context: DashboardContext<TActor, TTenant, TServices>,
): Promise<CompiledDashboardDefinition<TActor, TTenant, TServices> | null> {
  const explicit = definitions.filter(definition => definition.manifest.default)
  if (explicit.length > 1) throw new Error('Only one dashboard may be configured as default')
  const ordered = [...definitions].sort((left, right) => left.manifest.navigation.sort - right.manifest.navigation.sort || left.manifest.id.localeCompare(right.manifest.id))
  const candidates = explicit.length === 1 ? [...explicit, ...ordered.filter(definition => definition !== explicit[0])] : ordered
  for (const definition of candidates) {
    if (context.signal.aborted) throw context.signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
    if (await definition.server.authorize(context)) return definition
  }
  return null
}

export function createResourceWidgetContext<TRecord, TActor, TTenant, TServices>(
  context: DashboardContext<TActor, TTenant, TServices>,
  resourceId: string,
  pageId: string,
  placement: WidgetResourcePlacement,
  options: { readonly record?: Readonly<TRecord> | null, readonly tableState?: Readonly<TableQueryState> | null } = {},
): ResourceWidgetContext<TRecord, TActor, TTenant, TServices> {
  assertIdentifier(resourceId, 'Resource widget resources')
  assertIdentifier(pageId, 'Resource widget pages')
  return Object.freeze({
    ...context,
    pageId,
    placement,
    record: options.record ?? null,
    resourceId,
    tableState: options.tableState ?? null,
  })
}
