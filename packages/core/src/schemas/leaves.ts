import type { JsonObject, JsonValue } from '../protocol/json'
import { toJsonValue } from '../protocol/serialization'
import type { DeepReadonly } from '../builders/deep-freeze'
import type { EntryBuilder } from '../infolists/entries/base'
import type { EntryManifest, EntryResolverContext } from '../infolists/entries/types'
import type { FilterBuilder } from '../tables/filters/base'
import type { FilterManifest } from '../tables/filters/types'
import type { WidgetBuilder } from '../widgets/builder'
import type { WidgetManifest } from '../widgets/contracts'
import { SchemaComponentBuilder } from './builder'
import type { SchemaComponentProperties, SchemaLayoutProperties, SchemaLeafKind } from './contracts'

export interface EntrySchemaSource {
  compile(): Readonly<{ kind: 'entry', manifest: DeepReadonly<EntryManifest> }>
}

export interface FilterSchemaSource {
  compile(): Readonly<{ kind: 'filter', manifest: FilterManifest }>
}

export interface WidgetSchemaSource {
  compile(): Readonly<{ kind: 'widget', manifest: DeepReadonly<WidgetManifest> }>
}

type EntryRecord<TSource> = TSource extends EntryBuilder<infer TRecord, infer _TValue, infer _TType>
  ? TRecord
  : Readonly<Record<string, unknown>>

type EntryValue<TSource> = TSource extends EntryBuilder<infer _TRecord, infer TValue, infer _TType>
  ? TValue
  : JsonValue

type FilterValue<TSource> = TSource extends FilterBuilder<infer TValue, infer _TType, infer _TContext>
  ? TValue
  : JsonValue

type FilterContext<TSource> = TSource extends FilterBuilder<infer _TValue, infer _TType, infer TContext>
  ? TContext
  : unknown

type WidgetData<TSource> = TSource extends WidgetBuilder<infer TData, infer _TActor, infer _TTenant, infer _TServices, infer _TRecord>
  ? TData
  : JsonValue

type WidgetActor<TSource> = TSource extends WidgetBuilder<infer _TData, infer TActor, infer _TTenant, infer _TServices, infer _TRecord>
  ? TActor
  : unknown

type WidgetTenant<TSource> = TSource extends WidgetBuilder<infer _TData, infer _TActor, infer TTenant, infer _TServices, infer _TRecord>
  ? TTenant
  : unknown

type WidgetServices<TSource> = TSource extends WidgetBuilder<infer _TData, infer _TActor, infer _TTenant, infer TServices, infer _TRecord>
  ? TServices
  : unknown

export interface SchemaWidgetContext<TActor, TTenant, TServices> {
  readonly actor: TActor
  readonly services: TServices
  readonly tenant: TTenant
}

function jsonObject(value: unknown, label: string): JsonObject {
  const serialized = toJsonValue(value)
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError(`${label} must serialize to a JSON object`)
  }
  return serialized
}

function leafProperties(kind: SchemaLeafKind, definition: unknown): SchemaComponentProperties {
  return Object.freeze({ leaf: Object.freeze({ definition: jsonObject(definition, `Schema ${kind} definition`), kind }) })
}

function appendSlots<TValues, TContext>(
  component: SchemaComponentBuilder<TValues, TContext>,
  slots: DeepReadonly<EntryManifest>['slots'],
): void {
  for (const reference of slots.above ?? []) component.above(reference)
  for (const reference of slots.before ?? []) component.before(reference)
  for (const reference of slots.after ?? []) component.after(reference)
  for (const reference of slots.below ?? []) component.below(reference)
}

export class EntrySchemaComponentBuilder<
  TSource extends EntrySchemaSource,
  TValues = EntryRecord<TSource>,
  TContext = EntryResolverContext<EntryRecord<TSource>, EntryValue<TSource>>,
> extends SchemaComponentBuilder<TValues, TContext, 'entry'> {
  readonly #manifest: DeepReadonly<EntryManifest>

  constructor(source: TSource) {
    super('entry')
    const definition = source.compile()
    this.#manifest = definition.manifest
    const sourceId = this.#manifest.source.kind === 'computed' ? this.#manifest.source.id : this.#manifest.source.path
    this.key(`entry-${sourceId}`)
    if (this.#manifest.path) this.statePath(this.#manifest.path)
    this.visible(this.#manifest.visible)
    this.extraAttributes(this.#manifest.extraAttributes)
    appendSlots(this, this.#manifest.slots)
  }

  protected override componentType(): string {
    return this.#manifest.type
  }

  protected override componentProperties(): SchemaComponentProperties {
    return {
      ...leafProperties('entry', this.#manifest),
      label: this.#manifest.label,
    }
  }

  protected override layoutProperties(): SchemaLayoutProperties {
    return this.#manifest.layout
  }
}

export class FilterSchemaComponentBuilder<
  TSource extends FilterSchemaSource,
  TValues = Readonly<Record<string, FilterValue<TSource>>>,
  TContext = FilterContext<TSource>,
> extends SchemaComponentBuilder<TValues, TContext, 'filter'> {
  readonly #manifest: FilterManifest

  constructor(source: TSource) {
    super('filter')
    this.#manifest = source.compile().manifest
    this.key(`filter-${this.#manifest.id}`)
    this.statePath(this.#manifest.id)
  }

  protected override componentType(): string {
    return this.#manifest.type
  }

  protected override componentProperties(): SchemaComponentProperties {
    return {
      ...leafProperties('filter', this.#manifest),
      label: this.#manifest.label,
    }
  }

  protected override layoutProperties(): SchemaLayoutProperties {
    return this.#manifest.layout
  }
}

export class WidgetSchemaComponentBuilder<
  TSource extends WidgetSchemaSource,
  TValues = Readonly<{ data: WidgetData<TSource> }>,
  TContext = SchemaWidgetContext<WidgetActor<TSource>, WidgetTenant<TSource>, WidgetServices<TSource>>,
> extends SchemaComponentBuilder<TValues, TContext, 'widget'> {
  readonly #manifest: DeepReadonly<WidgetManifest>

  constructor(source: TSource) {
    super('widget')
    this.#manifest = source.compile().manifest
    this.key(`widget-${this.#manifest.id}`)
  }

  protected override componentType(): string {
    return this.#manifest.type
  }

  protected override componentProperties(): SchemaComponentProperties {
    return {
      ...leafProperties('widget', this.#manifest),
      description: this.#manifest.description,
      heading: this.#manifest.heading,
    }
  }

  protected override layoutProperties(): SchemaLayoutProperties {
    return {
      columnSpan: { default: this.#manifest.layout.columnSpan },
      ...(this.#manifest.layout.columnStart === null ? {} : { columnStart: { default: this.#manifest.layout.columnStart } }),
      order: { default: this.#manifest.sort },
    }
  }
}

export function schemaEntry<TSource extends EntrySchemaSource>(source: TSource): EntrySchemaComponentBuilder<TSource> {
  return new EntrySchemaComponentBuilder(source)
}

export function schemaFilter<TSource extends FilterSchemaSource>(source: TSource): FilterSchemaComponentBuilder<TSource> {
  return new FilterSchemaComponentBuilder(source)
}

export function schemaWidget<TSource extends WidgetSchemaSource>(source: TSource): WidgetSchemaComponentBuilder<TSource> {
  return new WidgetSchemaComponentBuilder(source)
}
