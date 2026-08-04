import { deepFreeze } from '../../builders/deep-freeze'
import { ComponentDefaultsApplicator } from '../../defaults/apply-defaults'
import type { JsonObject } from '../../protocol/json'
import type { OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource } from '../../inference/type-source'
import type { RecordPath, RecordPathFor } from '../columns/types'
import type {
  CompiledSummaryDefinition,
  CustomSummaryResolver,
  SummaryKind,
  SummaryManifest,
  SummaryMode,
} from './types'
import { queryColumn, safeJson, stableId } from './validation'

function safeProperties(value: JsonObject): JsonObject {
  const normalized = safeJson(value, 'Summary properties')
  if (normalized === null || Array.isArray(normalized) || typeof normalized !== 'object') {
    throw new Error('Summary properties must be a JSON object')
  }
  return normalized
}

export class SummaryBuilder<
  TRecord,
  TPath extends RecordPath<TRecord> | null,
  TKind extends SummaryKind,
  TContext = unknown,
> {
  readonly #id: string
  readonly #kind: TKind
  readonly #path: TPath
  readonly #column: string | null
  readonly #defaults: ComponentDefaultsApplicator<this>
  #mode: SummaryMode = 'page'
  #label: string | null = null
  #properties: JsonObject = {}
  #custom?: CustomSummaryResolver<TRecord, TContext>
  #compiled?: CompiledSummaryDefinition<TRecord, TPath, TContext>

  constructor(id: string, kind: TKind, path: TPath, column: string | null) {
    this.#id = stableId(id, 'summary ID')
    this.#kind = kind
    this.#path = path
    this.#column = column === null ? null : queryColumn(column, 'summary column')
    this.#defaults = new ComponentDefaultsApplicator('summary', kind)
  }

  label(value: string | null): this {
    this.assertMutable()
    if (value !== null && !value.trim()) throw new Error('Summary labels cannot be empty')
    this.#label = value?.trim() ?? null
    return this
  }

  page(): this {
    this.assertMutable()
    this.#mode = 'page'
    return this
  }

  fullQuery(): this {
    this.assertMutable()
    this.#mode = 'full-query'
    return this
  }

  properties(value: JsonObject): this {
    this.assertMutable()
    this.#properties = safeProperties(value)
    return this
  }

  resolveUsing(resolver: CustomSummaryResolver<TRecord, TContext>): this {
    this.assertMutable()
    if (this.#kind !== 'custom') throw new Error('Only custom summaries accept custom resolvers')
    this.#custom = resolver
    return this
  }

  compile(): CompiledSummaryDefinition<TRecord, TPath, TContext> {
    if (this.#compiled) return this.#compiled
    this.assertMutable()
    if (this.#kind === 'custom' && !this.#custom) throw new Error('Custom summaries require a resolver')
    if ((this.#kind === 'count' || this.#kind === 'custom') && (this.#path !== null || this.#column !== null)) {
      throw new Error(`${this.#kind} summaries cannot define an aggregate column`)
    }
    if (this.#kind !== 'count' && this.#kind !== 'custom' && (this.#path === null || this.#column === null)) {
      throw new Error(`${this.#kind} summaries require an allow-listed aggregate column`)
    }
    const manifest: SummaryManifest<TPath> = {
      id: this.#id,
      kind: this.#kind,
      mode: this.#mode,
      path: this.#path,
      column: this.#column,
      label: this.#label,
      properties: this.#properties,
    }
    const definition: CompiledSummaryDefinition<TRecord, TPath, TContext> = {
      kind: 'summary',
      manifest,
      server: this.#custom ? { custom: this.#custom } : {},
    }
    deepFreeze(definition)
    this.#compiled = definition
    return definition
  }

  private assertMutable(): void {
    this.#defaults.configure(this, Boolean(this.#compiled))
    if (this.#compiled) throw new Error('Cannot change a summary after compilation')
  }
}

export class SummaryFactory<TRecord, TContext = unknown> {
  count(id = 'count'): SummaryBuilder<TRecord, null, 'count', TContext> {
    return new SummaryBuilder(id, 'count', null, null)
  }

  sum<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column: string = path): SummaryBuilder<TRecord, TPath, 'sum', TContext> {
    return new SummaryBuilder(id, 'sum', path, column)
  }

  average<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column: string = path): SummaryBuilder<TRecord, TPath, 'average', TContext> {
    return new SummaryBuilder(id, 'average', path, column)
  }

  min<TPath extends RecordPathFor<TRecord, Date | number | string>>(id: string, path: TPath, column: string = path): SummaryBuilder<TRecord, TPath, 'min', TContext> {
    return new SummaryBuilder(id, 'min', path, column)
  }

  max<TPath extends RecordPathFor<TRecord, Date | number | string>>(id: string, path: TPath, column: string = path): SummaryBuilder<TRecord, TPath, 'max', TContext> {
    return new SummaryBuilder(id, 'max', path, column)
  }

  range<TPath extends RecordPathFor<TRecord, number>>(id: string, path: TPath, column: string = path): SummaryBuilder<TRecord, TPath, 'range', TContext> {
    return new SummaryBuilder(id, 'range', path, column)
  }

  custom(id: string, resolver: CustomSummaryResolver<TRecord, TContext>): SummaryBuilder<TRecord, null, 'custom', TContext> {
    return new SummaryBuilder<TRecord, null, 'custom', TContext>(id, 'custom', null, null).resolveUsing(resolver)
  }
}

export type SummaryTypeSource<TValue extends object> = RecordTypeSource & (
  | { readonly prototype: TValue }
  | { create(...parameters: never[]): TValue | Promise<TValue> }
)

export function summariesFor<TRecordSource extends RecordTypeSource, TContextSource extends RuntimeTypeSource | undefined = undefined>(_record: TRecordSource, _context?: TContextSource): SummaryFactory<RecordTypeValue<TRecordSource>, OptionalRuntimeTypeValue<TContextSource>> {
  return new SummaryFactory()
}
