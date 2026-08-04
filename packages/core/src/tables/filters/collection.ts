import { deepFreeze } from '../../builders/deep-freeze'
import { appendScopedRenderSlot, type RenderSlotReference } from '../../panels/render-slots'
import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonValue } from '../../protocol/json'
import { SCHEMA_BREAKPOINTS, type SchemaBreakpoint } from '../../schemas/contracts'
import type { TableQueryFilter, TableQueryFilterDefinition } from '../query/contracts'
import type {
  CompiledFilterDefinition,
  FilterExecutionContext,
  FilterIndicator,
  FilterCollectionPlacement,
  FilterCollectionPresentation,
  FilterManifest,
  FilterResponsiveColumns,
  P7AFilterCompatibility,
} from './types'
import { activeValue, jsonValue, validateQueryFilter } from './validation'

interface ExecutableFilterDefinition<TContext> {
  readonly manifest: FilterManifest<string, JsonValue>
  readonly queryDefinitions: Readonly<Record<string, TableQueryFilterDefinition>>
  encode(value: JsonValue, context: FilterExecutionContext<TContext>): Promise<TableQueryFilter | readonly TableQueryFilter[] | null>
  indicator?(value: JsonValue, context: FilterExecutionContext<TContext>): Promise<string>
}

export interface TableFilterSnapshot {
  readonly draft: Readonly<Record<string, JsonValue>>
  readonly applied: Readonly<Record<string, JsonValue>>
}

function presentationId(value: string): string {
  const id = value.trim()
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(id)) throw new Error('Filter collection presentation requires a stable identifier')
  return id
}

function presentationColumns(value: FilterResponsiveColumns): Readonly<Partial<Record<SchemaBreakpoint, number>>> {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error('Filter collection columns must be positive integers')
    return Object.freeze({ default: value })
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Filter collection columns must be a number or responsive map')
  const normalized: Partial<Record<SchemaBreakpoint, number>> = {}
  for (const [breakpoint, columns] of Object.entries(value)) {
    if (!SCHEMA_BREAKPOINTS.includes(breakpoint as SchemaBreakpoint)) throw new Error(`Invalid filter collection columns breakpoint: ${breakpoint}`)
    if (columns === undefined) continue
    if (!Number.isSafeInteger(columns) || columns < 1) throw new Error(`Filter collection columns must be positive integers at ${breakpoint}`)
    normalized[breakpoint as SchemaBreakpoint] = columns
  }
  if (Object.keys(normalized).length === 0) throw new Error('Filter collection columns require at least one breakpoint')
  return Object.freeze(normalized)
}

function manifestObject(manifest: FilterManifest): JsonObject {
  const serialized = toJsonValue(manifest)
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError('Filter manifests must serialize to JSON objects')
  }
  return serialized
}

function eraseFilter<TValue extends JsonValue, TType extends string, TContext>(
  definition: CompiledFilterDefinition<TValue, TType, TContext>,
): ExecutableFilterDefinition<TContext> {
  return {
    manifest: definition.manifest,
    queryDefinitions: definition.queryDefinitions,
    encode: async (value, context) => definition.server.encode(value as TValue, context),
    ...(definition.server.indicator
      ? { indicator: async (value: JsonValue, context: FilterExecutionContext<TContext>) => definition.server.indicator?.(value as TValue, context) ?? '' }
      : {}),
  }
}

export class FilterCollection<TContext = unknown> {
  readonly #definitions: Readonly<Record<string, ExecutableFilterDefinition<TContext>>>
  readonly queryDefinitions: Readonly<Record<string, TableQueryFilterDefinition>>
  #columns: Readonly<Partial<Record<SchemaBreakpoint, number>>> = Object.freeze({ default: 1 })
  #placement: FilterCollectionPlacement = 'inline'
  #slots: FilterCollectionPresentation['slots'] = Object.freeze({})

  constructor(definitions: readonly ExecutableFilterDefinition<TContext>[]) {
    const indexed: Record<string, ExecutableFilterDefinition<TContext>> = {}
    const queryDefinitions: Record<string, TableQueryFilterDefinition> = {}
    for (const definition of definitions) {
      const id = definition.manifest.id
      if (indexed[id]) throw new Error(`Duplicate filter definition: ${id}`)
      indexed[id] = definition
      for (const [queryId, queryDefinition] of Object.entries(definition.queryDefinitions)) {
        if (queryDefinitions[queryId]) throw new Error(`Duplicate filter query target: ${queryId}`)
        queryDefinitions[queryId] = queryDefinition
      }
    }
    deepFreeze(indexed)
    deepFreeze(queryDefinitions)
    this.#definitions = indexed
    this.queryDefinitions = queryDefinitions
  }

  manifests(): readonly FilterManifest[] {
    return Object.freeze(Object.values(this.#definitions).map(definition => definition.manifest))
  }

  columns(value: FilterResponsiveColumns): this {
    this.#columns = presentationColumns(value)
    return this
  }

  placement(value: FilterCollectionPlacement): this {
    this.#placement = value
    return this
  }

  dropdown(): this {
    return this.placement('dropdown')
  }

  inline(): this {
    return this.placement('inline')
  }

  modal(): this {
    return this.placement('modal')
  }

  before(reference: string | RenderSlotReference): this {
    this.#slots = appendScopedRenderSlot(this.#slots, 'before', reference, 'component')
    return this
  }

  after(reference: string | RenderSlotReference): this {
    this.#slots = appendScopedRenderSlot(this.#slots, 'after', reference, 'component')
    return this
  }

  presentation(id = 'table-filters'): FilterCollectionPresentation {
    const schemaId = presentationId(id)
    const components = this.manifests().map(manifest => Object.freeze({
      children: Object.freeze([]),
      dynamicVisibility: false,
      extraAttributes: Object.freeze({}),
      id: `${schemaId}.filter-${manifest.id}`,
      key: `filter-${manifest.id}`,
      kind: 'filter' as const,
      layout: manifest.layout,
      properties: Object.freeze({
        label: manifest.label,
        leaf: Object.freeze({ definition: manifestObject(manifest), kind: 'filter' as const }),
      }),
      slots: Object.freeze({}),
      statePath: manifest.id,
      type: manifest.type,
      visible: true,
    }))
    const presentation: FilterCollectionPresentation = {
      columns: this.#columns,
      id: schemaId,
      placement: this.#placement,
      schema: Object.freeze({ components: Object.freeze(components), id: schemaId, kind: 'schema' }),
      slots: this.#slots,
    }
    deepFreeze(presentation)
    return presentation
  }

  state(initial: Readonly<Record<string, JsonValue>> = {}): TableFilterState<TContext> {
    return new TableFilterState(this, initial)
  }

  async compile(
    values: Readonly<Record<string, JsonValue>>,
    context: FilterExecutionContext<TContext>,
  ): Promise<P7AFilterCompatibility> {
    for (const id of Object.keys(values)) this.require(id)
    const filters: TableQueryFilter[] = []
    for (const definition of Object.values(this.#definitions)) {
      const value = Object.hasOwn(values, definition.manifest.id)
        ? values[definition.manifest.id] as JsonValue
        : definition.manifest.defaultValue
      const encoded = await definition.encode(value, context)
      const items = encoded === null ? [] : Array.isArray(encoded) ? encoded : [encoded]
      for (const item of items) filters.push(validateQueryFilter(item, this.queryDefinitions))
    }
    return Object.freeze({ definitions: this.queryDefinitions, filters: Object.freeze(filters) })
  }

  require(id: string): ExecutableFilterDefinition<TContext> {
    const definition = this.#definitions[id]
    if (!definition) throw new Error(`Unknown filter definition: ${id}`)
    return definition
  }
}

export class TableFilterState<TContext = unknown> {
  readonly #collection: FilterCollection<TContext>
  #draft: Record<string, JsonValue>
  #applied: Record<string, JsonValue>

  constructor(collection: FilterCollection<TContext>, initial: Readonly<Record<string, JsonValue>> = {}) {
    this.#collection = collection
    const defaults = Object.fromEntries(collection.manifests().map(manifest => [manifest.id, manifest.defaultValue]))
    for (const [id, value] of Object.entries(initial)) {
      collection.require(id)
      defaults[id] = jsonValue(value, `Initial filter ${id}`)
    }
    this.#draft = { ...defaults }
    this.#applied = { ...defaults }
  }

  snapshot(): TableFilterSnapshot {
    const snapshot: TableFilterSnapshot = { draft: { ...this.#draft }, applied: { ...this.#applied } }
    deepFreeze(snapshot)
    return snapshot
  }

  update(id: string, value: JsonValue): this {
    const definition = this.#collection.require(id)
    const normalized = jsonValue(value, `Filter ${id}`)
    this.#draft = { ...this.#draft, [id]: normalized }
    if (definition.manifest.mode === 'live') this.#applied = { ...this.#applied, [id]: normalized }
    return this
  }

  applyDeferred(): this {
    this.#applied = { ...this.#draft }
    return this
  }

  reset(id: string): this {
    const definition = this.#collection.require(id)
    const value = definition.manifest.defaultValue
    this.#draft = { ...this.#draft, [id]: value }
    this.#applied = { ...this.#applied, [id]: value }
    return this
  }

  resetAll(): this {
    for (const manifest of this.#collection.manifests()) this.reset(manifest.id)
    return this
  }

  remove(id: string): this {
    return this.reset(id)
  }

  removeAll(): this {
    return this.resetAll()
  }

  async indicators(context: FilterExecutionContext<TContext>): Promise<readonly FilterIndicator[]> {
    const indicators: FilterIndicator[] = []
    for (const manifest of this.#collection.manifests()) {
      const value = this.#applied[manifest.id] ?? manifest.defaultValue
      if (!activeValue(value, manifest.defaultValue)) continue
      const definition = this.#collection.require(manifest.id)
      const label = definition.indicator
        ? await definition.indicator(value, context)
        : manifest.label ?? manifest.id
      indicators.push(Object.freeze({ filterId: manifest.id, label, value }))
    }
    return Object.freeze(indicators)
  }

  compile(context: FilterExecutionContext<TContext>): Promise<P7AFilterCompatibility> {
    return this.#collection.compile(this.#applied, context)
  }
}

export function filterCollection<TContext = unknown>(
  ...definitions: readonly ExecutableFilterDefinition<TContext>[]
): FilterCollection<TContext> {
  return new FilterCollection(definitions)
}

export function asFilterDefinition<TValue extends JsonValue, TType extends string, TContext>(
  definition: CompiledFilterDefinition<TValue, TType, TContext>,
): ExecutableFilterDefinition<TContext> {
  return eraseFilter(definition)
}
