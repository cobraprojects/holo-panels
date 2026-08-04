import type { JsonObject } from '../protocol/json'
import type { ExtensionTypeId } from '../plugins/type-id'
import { ComponentDefaultsApplicator } from '../defaults/apply-defaults'
import type { ContextTypeSources, OptionalRuntimeTypeValue, RecordTypeSource, RecordTypeValue, RuntimeTypeSource, RuntimeTypeValue } from '../inference/type-source'
import type { ActionDefinition, ActionKind, ActionMount } from './contracts'

export interface ActionPersistence<TRecord, TInput extends JsonObject, TResult> {
  create?(input: TInput): Promise<TResult>
  delete?(record: TRecord): Promise<TResult>
  forceDelete?(record: TRecord): Promise<TResult>
  replicate?(record: TRecord, input: TInput): Promise<TResult>
  restore?(record: TRecord): Promise<TResult>
  update?(record: TRecord, input: TInput): Promise<TResult>
}

export interface BuiltinActionOptions<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
  readonly authorize: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['authorize']
  readonly id?: string
  readonly label?: string
  readonly mount?: ActionMount
}

class ActionDefaultBuilder {
  readonly #defaults: ComponentDefaultsApplicator<this>
  #label: string | null = null

  constructor(type: string) {
    this.#defaults = new ComponentDefaultsApplicator('action', type)
    this.#defaults.configure(this)
  }

  get configuredLabel(): string | null {
    return this.#label
  }

  label(value: string | null): this {
    this.#label = value
    return this
  }
}

function operationName(kind: ActionKind): keyof ActionPersistence<object, JsonObject, unknown> {
  if (kind === 'edit') return 'update'
  if (kind === 'force-delete') return 'forceDelete'
  return kind as keyof ActionPersistence<object, JsonObject, unknown>
}

export function createBuiltinAction<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  kind: Exclude<ActionKind, 'custom' | 'view'>,
  persistence: ActionPersistence<TRecord, TInput, TResult>,
  options: BuiltinActionOptions<TRecord, TInput, TResult, TActor, TTenant, TServices>,
): ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices> {
  const operation = operationName(kind)
  const defaultLabel = new ActionDefaultBuilder(kind).configuredLabel
  return Object.freeze({
    authorize: options.authorize,
    handle: async (
      input: TInput,
      context: Parameters<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['handle']>[1],
    ): Promise<TResult> => {
      const handler = persistence[operation]
      if (!handler) throw new Error('The configured persistence adapter does not support action "' + kind + '"')
      if (kind === 'create') return (handler as (value: TInput) => Promise<TResult>)(input)
      if (!context.record) throw new Error('Record persistence actions require a resolved record')
      if (kind === 'edit' || kind === 'replicate') {
        return (handler as (record: TRecord, value: TInput) => Promise<TResult>)(context.record, input)
      }
      return (handler as (record: TRecord) => Promise<TResult>)(context.record)
    },
    id: options.id ?? kind,
    kind,
    label: options.label ?? defaultLabel ?? kind.split('-').map(value => value[0]?.toUpperCase() + value.slice(1)).join(' '),
    mount: options.mount ?? (kind === 'create' ? 'page' : 'record'),
    transactional: true,
  })
}

export function actionsFor<
  TRecordSource extends RecordTypeSource,
  TInputSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(_sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource> & {
  readonly input: TInputSource
  readonly record: TRecordSource
}): {
  builtin<TResult>(
    kind: Exclude<ActionKind, 'custom' | 'view'>,
    persistence: ActionPersistence<RecordTypeValue<TRecordSource>, RecordTypeValue<TInputSource> & JsonObject, TResult>,
    options: BuiltinActionOptions<
      RecordTypeValue<TRecordSource>,
      RecordTypeValue<TInputSource> & JsonObject,
      TResult,
      RuntimeTypeValue<TActorSource>,
      OptionalRuntimeTypeValue<TTenantSource>,
      OptionalRuntimeTypeValue<TServicesSource>
    >,
  ): ActionDefinition<
    RecordTypeValue<TRecordSource>,
    RecordTypeValue<TInputSource> & JsonObject,
    TResult,
    RuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>
  >
  custom<TResult>(definition: ActionDefinition<
    RecordTypeValue<TRecordSource>,
    RecordTypeValue<TInputSource> & JsonObject,
    TResult,
    RuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>
  > & { readonly type?: ExtensionTypeId<'action'> }): ActionDefinition<
    RecordTypeValue<TRecordSource>,
    RecordTypeValue<TInputSource> & JsonObject,
    TResult,
    RuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>
  >
  view(options: {
    readonly authorize: ActionDefinition<
      RecordTypeValue<TRecordSource>,
      JsonObject,
      RecordTypeValue<TRecordSource>,
      RuntimeTypeValue<TActorSource>,
      OptionalRuntimeTypeValue<TTenantSource>,
      OptionalRuntimeTypeValue<TServicesSource>
    >['authorize']
    readonly id?: string
    readonly label?: string
  }): ActionDefinition<
    RecordTypeValue<TRecordSource>,
    JsonObject,
    RecordTypeValue<TRecordSource>,
    RuntimeTypeValue<TActorSource>,
    OptionalRuntimeTypeValue<TTenantSource>,
    OptionalRuntimeTypeValue<TServicesSource>
  >
} {
  return Object.freeze({
    builtin: (kind, persistence, options) => createBuiltinAction(kind, persistence, options),
    custom: definition => createCustomAction(definition),
    view: options => createViewAction(options),
  })
}

export function createViewAction<TRecord, TActor, TTenant, TServices>(
  options: {
    readonly authorize: ActionDefinition<TRecord, JsonObject, TRecord, TActor, TTenant, TServices>['authorize']
    readonly id?: string
    readonly label?: string
  },
): ActionDefinition<TRecord, JsonObject, TRecord, TActor, TTenant, TServices> {
  const defaultLabel = new ActionDefaultBuilder('view').configuredLabel
  return Object.freeze({
    authorize: options.authorize,
    handle: async (
      _input: JsonObject,
      context: Parameters<ActionDefinition<TRecord, JsonObject, TRecord, TActor, TTenant, TServices>['handle']>[1],
    ): Promise<TRecord> => {
      if (!context.record) throw new Error('View actions require a resolved record')
      return context.record
    },
    id: options.id ?? 'view',
    kind: 'view',
    label: options.label ?? defaultLabel ?? 'View',
    mount: 'record',
    transactional: false,
  })
}

export function createCustomAction<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices>(
  definition: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices> & {
    readonly type?: ExtensionTypeId<'action'>
  },
): ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices> {
  return Object.freeze({ ...definition, kind: 'custom' })
}
