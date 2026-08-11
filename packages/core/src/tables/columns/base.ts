import { ConstructionBuilder } from '../../builders/construction-builder'
import { toJsonValue } from '../../protocol/serialization'
import type { JsonObject, JsonValue } from '../../protocol/json'
import type {
  ColumnAggregate,
  ColumnAlignment,
  ColumnDataSource,
  ColumnManifest,
  ColumnResolver,
  ColumnServerHandles,
  CompiledColumnDefinition,
  InlineEditorManifest,
  RecordPath,
  RecordPathValue,
  RelatedRecord,
  RelationPath,
  TextFormatter,
} from './types'

interface ColumnState<TRecord, TPath extends RecordPath<TRecord>> {
  action?: ColumnResolver<TRecord, TPath, string | null>
  alignment: ColumnAlignment
  copyable: boolean
  dataSource: ColumnDataSource
  formatters: TextFormatter[]
  hidden: boolean
  inlineEditor: InlineEditorManifest | null
  label: string | null
  lineClamp: number | null
  path: TPath
  searchable: boolean
  sortable: boolean
  state?: ColumnResolver<TRecord, TPath, JsonValue>
  toggleable: boolean
  tooltip?: ColumnResolver<TRecord, TPath, string | null>
  url?: ColumnResolver<TRecord, TPath, string | null>
  width: number | string | null
  wrap: boolean
}

function jsonObject(value: unknown): JsonObject {
  const serialized = toJsonValue(value)
  if (serialized === null || Array.isArray(serialized) || typeof serialized !== 'object') {
    throw new TypeError('Column manifests must serialize to JSON objects')
  }
  return serialized
}

function validatePositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive integer`)
}

export abstract class ColumnBuilder<
  TRecord,
  TPath extends RecordPath<TRecord>,
  TType extends string,
> extends ConstructionBuilder<ColumnState<TRecord, TPath>, CompiledColumnDefinition<TRecord, TPath, TType>> {
  declare readonly resourceRecordType: TRecord
  readonly #type: TType

  protected constructor(type: TType, path: TPath) {
    super({
      alignment: 'start',
      copyable: false,
      dataSource: { kind: 'path' },
      formatters: [],
      hidden: false,
      inlineEditor: null,
      label: null,
      lineClamp: null,
      path,
      searchable: false,
      sortable: false,
      toggleable: true,
      width: null,
      wrap: true,
    })
    this.#type = type
    this.configureComponentDefaults('column', type)
    this.registerInvariant('column-label', state => {
      if (state.label !== null && state.label.trim().length === 0) throw new Error('Column labels cannot be empty')
    })
  }

  label(value: string | null): this {
    return this.writeState('label', value)
  }

  sortable(value = true): this {
    return this.writeState('sortable', value)
  }

  searchable(value = true): this {
    return this.writeState('searchable', value)
  }

  toggleable(value = true): this {
    return this.writeState('toggleable', value)
  }

  hidden(value = true): this {
    return this.writeState('hidden', value)
  }

  alignment(value: ColumnAlignment): this {
    return this.writeState('alignment', value)
  }

  width(value: number | string | null): this {
    if (typeof value === 'number' && (!Number.isFinite(value) || value <= 0)) throw new Error('Column width must be positive')
    if (typeof value === 'string' && !/^(?:auto|\d+(?:\.\d+)?(?:ch|em|px|rem|%))$/u.test(value)) throw new Error('Column width is invalid')
    return this.writeState('width', value)
  }

  wrap(value = true): this {
    return this.writeState('wrap', value)
  }

  lineClamp(lines: number | null): this {
    if (lines !== null) validatePositiveInteger(lines, 'Line clamp')
    return this.writeState('lineClamp', lines)
  }

  tooltip(value: string | null | ColumnResolver<TRecord, TPath, string | null>): this {
    return typeof value === 'function'
      ? this.writeState('tooltip', value)
      : this.addFormatter({ kind: 'tooltip', value })
  }

  url(value: string | null | ColumnResolver<TRecord, TPath, string | null>): this {
    if (typeof value === 'function') return this.writeState('url', value)
    toJsonValue({ url: value })
    return this.addFormatter({ kind: 'url', value })
  }

  action(value: string | ColumnResolver<TRecord, TPath, string | null>): this {
    if (typeof value === 'function') return this.writeState('action', value)
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(value)) throw new Error('Column actions require stable action IDs')
    return this.addFormatter({ kind: 'action', value })
  }

  copyable(value = true): this {
    return this.writeState('copyable', value)
  }

  state(resolver: ColumnResolver<TRecord, TPath, JsonValue>): this {
    return this.writeState('state', resolver)
  }

  relationship<TRelationPath extends RelationPath<TRecord>>(
    relation: TRelationPath,
    titlePath: RecordPath<RelatedRecord<RecordPathValue<TRecord, TRelationPath>>>,
  ): this {
    return this.writeState('dataSource', { kind: 'relationship', relation, titlePath })
  }

  count<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath): this {
    return this.writeState('dataSource', { kind: 'count', relation })
  }

  exists<TRelationPath extends RelationPath<TRecord>>(relation: TRelationPath): this {
    return this.writeState('dataSource', { kind: 'exists', relation })
  }

  aggregate<TRelationPath extends RelationPath<TRecord>>(
    relation: TRelationPath,
    field: RecordPath<RelatedRecord<RecordPathValue<TRecord, TRelationPath>>>,
    aggregate: ColumnAggregate,
  ): this {
    return this.writeState('dataSource', { aggregate, field, kind: 'aggregate', relation })
  }

  protected addFormatter(formatter: TextFormatter): this {
    return this.writeState('formatters', [...this.readState().formatters, formatter])
  }

  protected inlineEditor(editor: InlineEditorManifest): this {
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(editor.action)) throw new Error('Inline editor actions require a stable action ID')
    return this.writeState('inlineEditor', editor)
  }

  protected createDefinition(state: Readonly<ColumnState<TRecord, TPath>>): CompiledColumnDefinition<TRecord, TPath, TType> {
    const manifest = {
      alignment: state.alignment,
      copyable: state.copyable,
      dataSource: state.dataSource,
      formatters: state.formatters,
      hidden: state.hidden,
      inlineEditor: state.inlineEditor,
      label: state.label,
      lineClamp: state.lineClamp,
      path: state.path,
      searchable: state.searchable,
      sortable: state.sortable,
      toggleable: state.toggleable,
      type: this.#type,
      width: state.width,
      wrap: state.wrap,
    } satisfies ColumnManifest & { type: TType, path: TPath }
    jsonObject(manifest)
    const server: ColumnServerHandles<TRecord, TPath> = {
      ...(state.action ? { action: state.action } : {}),
      ...(state.state ? { state: state.state } : {}),
      ...(state.tooltip ? { tooltip: state.tooltip } : {}),
      ...(state.url ? { url: state.url } : {}),
    }
    return { kind: 'column', manifest, server }
  }
}
