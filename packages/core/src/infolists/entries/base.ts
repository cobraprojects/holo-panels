import { ConstructionBuilder } from '../../builders/construction-builder'
import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonValue } from '../../protocol/json'
import {
  SCHEMA_BREAKPOINTS,
  type ResponsiveValue,
  type SchemaBreakpoint,
  type SchemaColumnSpan,
  type SchemaLayoutProperties,
  type SchemaRenderSlots,
} from '../../schemas/contracts'
import { appendScopedRenderSlot, type RenderSlotReference } from '../../panels/render-slots'
import type {
  CompiledEntryDefinition,
  EntryFormat,
  EntryManifest,
  EntryRecordPath,
  EntryRecordPathValue,
  EntryRelatedRecord,
  EntryRelationPath,
  EntryResolver,
  EntryServerHandles,
  EntryStateSource,
} from './types'

interface EntryState<TRecord, TValue> {
  actions: string[]
  copyable: boolean
  defaultValue: JsonValue
  extraAttributes: JsonObject
  formatters: EntryFormat[]
  inlineLabel: boolean
  label: string | null
  columnSpan?: ResponsiveValue<SchemaColumnSpan>
  columnStart?: ResponsiveValue<number>
  placeholder: string | null
  source: EntryStateSource
  slots: SchemaRenderSlots
  state?: EntryResolver<TRecord, TValue, unknown>
  tooltip?: EntryResolver<TRecord, TValue, string | null>
  url?: EntryResolver<TRecord, TValue, string | null>
  visibility: boolean | EntryResolver<TRecord, TValue, boolean>
}

const componentPattern = /^[A-Za-z][A-Za-z0-9]*(?:[._:-][A-Za-z0-9]+)*$/u

function normalizeResponsive<TValue>(
  value: ResponsiveValue<TValue>,
  validate: (item: TValue) => boolean,
  name: string,
): Readonly<Partial<Record<SchemaBreakpoint, TValue>>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    if (!validate(value as TValue)) throw new Error(`Invalid entry ${name}: ${String(value)}`)
    return Object.freeze({ default: value })
  }
  const input = value as Readonly<Record<string, TValue | undefined>>
  const normalized: Partial<Record<SchemaBreakpoint, TValue>> = {}
  for (const breakpoint of Object.keys(input)) {
    if (!SCHEMA_BREAKPOINTS.includes(breakpoint as SchemaBreakpoint)) throw new Error(`Invalid entry ${name} breakpoint: ${breakpoint}`)
    const item = input[breakpoint]
    if (item !== undefined) {
      if (!validate(item)) throw new Error(`Invalid entry ${name} at ${breakpoint}: ${String(item)}`)
      normalized[breakpoint as SchemaBreakpoint] = item
    }
  }
  if (Object.keys(normalized).length === 0) throw new Error(`Entry ${name} must define at least one breakpoint`)
  return Object.freeze(normalized)
}

function normalizeJsonObject(value: unknown, name: string): JsonObject {
  const normalized = toJsonValue(value)
  if (normalized === null || Array.isArray(normalized) || typeof normalized !== 'object') throw new Error(`${name} must be a JSON-safe object`)
  return normalized
}

function normalizeReference(reference: string | RenderSlotReference): RenderSlotReference {
  const component = (typeof reference === 'string' ? reference : reference.component).trim()
  if (!componentPattern.test(component)) throw new Error('Entry slots require a named registered component')
  const order = typeof reference === 'string' ? undefined : reference.order
  if (order !== undefined && !Number.isSafeInteger(order)) throw new Error('Entry slot order must be a safe integer')
  const properties = typeof reference === 'string' || reference.properties === undefined
    ? undefined
    : normalizeJsonObject(reference.properties, 'Entry slot properties')
  return Object.freeze({ component, ...(order === undefined ? {} : { order }), ...(properties === undefined ? {} : { properties }) })
}

function stableIdentifier(value: string, label: string): void {
  if (!/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/u.test(value)) throw new Error(`${label} requires a stable identifier`)
}

function entryProperties(formatters: readonly EntryFormat[]): JsonObject {
  const properties: Record<string, JsonValue> = { formats: [...formatters] }
  for (const formatter of formatters) {
    if (formatter.kind === 'alt') properties.alt = formatter.value ?? null
    if (formatter.kind === 'badge') properties.badge = formatter.value ?? null
    if (formatter.kind === 'boolean-icons') {
      properties.falsyIcon = formatter.falsy ?? null
      properties.truthyIcon = formatter.truthy ?? null
    }
    if (formatter.kind === 'circular') properties.circular = formatter.value ?? null
    if (formatter.kind === 'configuration') properties.configuration = formatter.configuration ?? null
    if (formatter.kind === 'icon') properties.icon = formatter.name ?? null
    if (formatter.kind === 'key-label') properties.keyLabel = formatter.value ?? null
    if (formatter.kind === 'language') properties.language = formatter.value ?? null
    if (formatter.kind === 'line-numbers') properties.lineNumbers = formatter.value ?? null
    if (formatter.kind === 'schema') properties.schema = formatter.entries ?? null
    if (formatter.kind === 'size') properties.size = formatter.pixels ?? null
    if (formatter.kind === 'value-label') properties.valueLabel = formatter.value ?? null
  }
  return properties
}

export abstract class EntryBuilder<TRecord, TValue, TType extends string> extends ConstructionBuilder<
  EntryState<TRecord, TValue>,
  CompiledEntryDefinition<TRecord, TValue, TType>
> {
  declare readonly resourceRecordType: TRecord
  readonly #type: TType

  protected constructor(type: TType, source: EntryStateSource) {
    super({
      actions: [],
      copyable: false,
      defaultValue: null,
      extraAttributes: {},
      formatters: [],
      inlineLabel: false,
      label: null,
      placeholder: null,
      source,
      slots: {},
      visibility: true,
    })
    this.#type = type
    this.configureComponentDefaults('entry', type)
  }

  label(value: string | null): this {
    if (value !== null && !value.trim()) throw new Error('Entry labels cannot be empty')
    return this.writeState('label', value)
  }

  inlineLabel(value = true): this {
    return this.writeState('inlineLabel', value)
  }

  copyable(value = true): this {
    return this.writeState('copyable', value)
  }

  visible(value: boolean | EntryResolver<TRecord, TValue, boolean> = true): this {
    return this.writeState('visibility', value)
  }

  hidden(value: boolean | EntryResolver<TRecord, TValue, boolean> = true): this {
    return this.writeState('visibility', typeof value === 'function'
      ? async context => !await value(context)
      : !value)
  }

  columnSpan(value: ResponsiveValue<SchemaColumnSpan>): this {
    return this.writeState('columnSpan', value)
  }

  columnStart(value: ResponsiveValue<number>): this {
    return this.writeState('columnStart', value)
  }

  extraAttributes(value: Readonly<Record<string, unknown>>): this {
    return this.writeState('extraAttributes', normalizeJsonObject(value, 'Entry extra attributes'))
  }

  before(reference: string | RenderSlotReference): this {
    return this.setSlot('before', reference)
  }

  after(reference: string | RenderSlotReference): this {
    return this.setSlot('after', reference)
  }

  above(reference: string | RenderSlotReference): this {
    return this.setSlot('above', reference)
  }

  below(reference: string | RenderSlotReference): this {
    return this.setSlot('below', reference)
  }

  placeholder(value: string | null): this {
    return this.writeState('placeholder', value)
  }

  default(value: unknown): this {
    return this.writeState('defaultValue', toJsonValue(value))
  }

  state(resolver: EntryResolver<TRecord, TValue, unknown>, id = 'state'): this {
    stableIdentifier(id, 'Computed entry state')
    this.writeState('source', { kind: 'computed', id })
    return this.writeState('state', resolver)
  }

  field<const TPath extends EntryRecordPath<TRecord>>(path: TPath): this {
    return this.writeState('source', { kind: 'path', path })
  }

  json<const TPath extends EntryRecordPath<TRecord>>(path: TPath): this {
    return this.writeState('source', { kind: 'json', path })
  }

  relationship<
    const TRelationPath extends EntryRelationPath<TRecord>,
    const TTitlePath extends EntryRecordPath<EntryRelatedRecord<EntryRecordPathValue<TRecord, TRelationPath>>>,
  >(path: TRelationPath, titlePath: TTitlePath): this {
    return this.writeState('source', { kind: 'relationship', path, titlePath })
  }

  tooltip(value: string | null | EntryResolver<TRecord, TValue, string | null>): this {
    if (typeof value === 'function') return this.writeState('tooltip', value)
    return this.addFormat({ kind: 'tooltip', value })
  }

  url(value: string | null | EntryResolver<TRecord, TValue, string | null>): this {
    if (typeof value === 'function') return this.writeState('url', value)
    toJsonValue({ url: value })
    return this.addFormat({ kind: 'url', value })
  }

  action(id: string): this {
    stableIdentifier(id, 'Entry actions')
    if (this.readState().actions.includes(id)) throw new Error(`Duplicate entry action "${id}"`)
    return this.writeState('actions', [...this.readState().actions, id])
  }

  protected addFormat(formatter: EntryFormat): this {
    return this.writeState('formatters', [...this.readState().formatters, formatter])
  }

  protected createDefinition(state: Readonly<EntryState<TRecord, TValue>>): CompiledEntryDefinition<TRecord, TValue, TType> {
    const dynamicVisibility = typeof state.visibility === 'function'
    const layout: SchemaLayoutProperties = {
      ...(state.columnSpan === undefined ? {} : {
        columnSpan: normalizeResponsive(state.columnSpan, item => item === 'full' || Number.isSafeInteger(item) && item > 0, 'column span'),
      }),
      ...(state.columnStart === undefined ? {} : {
        columnStart: normalizeResponsive(state.columnStart, item => Number.isSafeInteger(item) && item > 0, 'column start'),
      }),
    }
    const manifest = {
      actions: state.actions,
      copyable: state.copyable,
      defaultValue: state.defaultValue,
      dynamicVisibility,
      extraAttributes: state.extraAttributes,
      formatters: state.formatters,
      inlineLabel: state.inlineLabel,
      label: state.label,
      layout,
      path: state.source.kind === 'computed' ? null : state.source.path,
      placeholder: state.placeholder,
      properties: entryProperties(state.formatters),
      source: state.source,
      slots: state.slots,
      type: this.#type,
      visible: dynamicVisibility ? true : state.visibility,
    } satisfies EntryManifest & { type: TType }
    const serialized = toJsonValue(manifest)
    if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
      throw new TypeError('Entry manifests must serialize to JSON objects')
    }
    const server: EntryServerHandles<TRecord, TValue> = {
      ...(state.state ? { state: state.state } : {}),
      ...(state.tooltip ? { tooltip: state.tooltip } : {}),
      ...(state.url ? { url: state.url } : {}),
      ...(dynamicVisibility ? { visibility: state.visibility as EntryResolver<TRecord, TValue, boolean> } : {}),
    }
    return { kind: 'entry', manifest, server }
  }

  protected configuration(value: JsonObject): this {
    return this.addFormat({ configuration: toJsonValue(value), kind: 'configuration' })
  }

  private setSlot(slot: keyof SchemaRenderSlots, reference: string | RenderSlotReference): this {
    return this.writeState('slots', appendScopedRenderSlot(
      this.readState().slots,
      slot,
      normalizeReference(reference),
      'component',
    ))
  }
}
