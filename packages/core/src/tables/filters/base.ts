import { deepFreeze } from '../../builders/deep-freeze'
import { ComponentDefaultsApplicator } from '../../defaults/apply-defaults'
import type { JsonObject, JsonValue } from '../../protocol/json'
import {
  SCHEMA_BREAKPOINTS,
  type ResponsiveValue,
  type SchemaBreakpoint,
  type SchemaColumnSpan,
} from '../../schemas/contracts'
import type { TableQueryFilterDefinition } from '../query/contracts'
import type {
  CompiledFilterDefinition,
  FilterEncoder,
  FilterIndicatorResolver,
  FilterLayout,
  FilterManifest,
  FilterMode,
  FilterServerHandles,
} from './types'
import { assertFilterId, jsonObject, jsonValue } from './validation'

interface FilterBuilderState<TValue extends JsonValue, TContext> {
  label: string | null
  mode: FilterMode
  defaultValue: TValue
  layout: FilterLayout
  indicator?: FilterIndicatorResolver<TValue, TContext>
}

function responsive<TValue>(
  value: ResponsiveValue<TValue>,
  validate: (item: TValue) => boolean,
  label: string,
): Readonly<Partial<Record<SchemaBreakpoint, TValue>>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (!validate(value as TValue)) throw new Error(`${label} is invalid`)
    return Object.freeze({ default: value })
  }
  const normalized: Partial<Record<SchemaBreakpoint, TValue>> = {}
  for (const [breakpoint, item] of Object.entries(value)) {
    if (!SCHEMA_BREAKPOINTS.includes(breakpoint as SchemaBreakpoint)) throw new Error(`${label} breakpoint is invalid: ${breakpoint}`)
    if (item === undefined) continue
    if (!validate(item as TValue)) throw new Error(`${label} is invalid at ${breakpoint}`)
    normalized[breakpoint as SchemaBreakpoint] = item as TValue
  }
  if (Object.keys(normalized).length === 0) throw new Error(`${label} requires at least one breakpoint`)
  return Object.freeze(normalized)
}

export abstract class FilterBuilder<
  TValue extends JsonValue,
  TType extends string,
  TContext = unknown,
> {
  readonly id: string
  readonly type: TType
  readonly #defaults: ComponentDefaultsApplicator<this>
  readonly #state: FilterBuilderState<TValue, TContext>
  #compiled?: CompiledFilterDefinition<TValue, TType, TContext>

  protected constructor(id: string, type: TType, defaultValue: TValue) {
    this.id = assertFilterId(id)
    this.type = type
    this.#defaults = new ComponentDefaultsApplicator('filter', type)
    this.#state = {
      label: null,
      mode: 'deferred',
      defaultValue,
      layout: {},
    }
  }

  label(value: string | null): this {
    this.assertMutable()
    if (value !== null && !value.trim()) throw new Error('Filter labels cannot be empty')
    this.#state.label = value?.trim() ?? null
    return this
  }

  default(value: TValue): this {
    this.assertMutable()
    this.#state.defaultValue = jsonValue(value, 'Filter default') as TValue
    return this
  }

  live(value = true): this {
    this.assertMutable()
    this.#state.mode = value ? 'live' : 'deferred'
    return this
  }

  deferred(value = true): this {
    this.assertMutable()
    this.#state.mode = value ? 'deferred' : 'live'
    return this
  }

  columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this {
    this.assertMutable()
    this.#state.layout = {
      ...this.#state.layout,
      columnSpan: responsive(value, item => item === 'full' || Number.isSafeInteger(item) && item > 0, 'Filter column span'),
    }
    return this
  }

  columnStart(value: ResponsiveValue<number>): this {
    this.assertMutable()
    this.#state.layout = {
      ...this.#state.layout,
      columnStart: responsive(value, item => Number.isSafeInteger(item) && item > 0, 'Filter column start'),
    }
    return this
  }

  indicator(resolver: FilterIndicatorResolver<TValue, TContext>): this {
    this.assertMutable()
    this.#state.indicator = resolver
    return this
  }

  compile(): CompiledFilterDefinition<TValue, TType, TContext> {
    if (this.#compiled) return this.#compiled
    this.assertMutable()
    const definitions = this.queryDefinitions()
    const properties = jsonObject(this.properties(), 'Filter properties')
    const manifest: FilterManifest<TType, TValue> = {
      id: this.id,
      type: this.type,
      label: this.#state.label,
      mode: this.#state.mode,
      defaultValue: this.#state.defaultValue,
      layout: this.#state.layout,
      properties,
    }
    const server: FilterServerHandles<TValue, TContext> = {
      encode: this.encoder(),
      ...(this.#state.indicator ? { indicator: this.#state.indicator } : {}),
      ...this.additionalServerHandles(),
    }
    const definition: CompiledFilterDefinition<TValue, TType, TContext> = {
      kind: 'filter',
      manifest,
      queryDefinitions: definitions,
      server,
    }
    deepFreeze(definition)
    this.#compiled = definition
    return definition
  }

  protected assertMutable(): void {
    this.#defaults.configure(this, Boolean(this.#compiled))
    if (this.#compiled) throw new Error(`Cannot change ${this.type} filter after compilation`)
  }

  protected properties(): JsonObject {
    return {}
  }

  protected additionalServerHandles(): Partial<FilterServerHandles<TValue, TContext>> {
    return {}
  }

  protected abstract queryDefinitions(): Readonly<Record<string, TableQueryFilterDefinition>>
  protected abstract encoder(): FilterEncoder<TValue, TContext>
}
