import type { JsonObject } from '../protocol/json'
import type { ExtensionTypeId } from '../plugins/type-id'
import { deepFreeze } from '../builders/deep-freeze'
import type {
  ContextTypeSources,
  OptionalRuntimeTypeValue,
  RecordTypeSource,
  RecordTypeValue,
  RuntimeTypeSource,
  RuntimeTypeValue,
} from '../inference/type-source'
import type {
  ActionContext,
  ActionDefinition,
  ActionFailureNotification,
  ActionModalOptions,
  ActionMount,
  ActionRateLimit,
  ActionResolvable,
  ActionSize,
  ActionSuccessNotification,
} from './contracts'

type ActionHandler<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> =
  ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['handle']

type Context<TRecord, TActor, TTenant, TServices> = ActionContext<TRecord, TActor, TTenant, TServices>

interface ActionBuilderState<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
  authorize: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['authorize'] | null
  badge?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>
  color?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>
  confirmation?: string
  disabled?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>
  failureNotification?: ActionFailureNotification<Context<TRecord, TActor, TTenant, TServices>>
  handle: ActionHandler<TRecord, TInput, TResult, TActor, TTenant, TServices> | null
  icon?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>
  label: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string>
  lifecycle?: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['lifecycle']
  modal?: ActionModalOptions<Context<TRecord, TActor, TTenant, TServices>>
  mount: ActionMount
  mutateInput?: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['mutateInput']
  notification?: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['notification']
  rateLimit?: ActionRateLimit<Context<TRecord, TActor, TTenant, TServices>>
  sideEffects?: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['sideEffects']
  size?: ActionSize
  successNotification?: ActionSuccessNotification<TResult, Context<TRecord, TActor, TTenant, TServices>>
  tooltip?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>
  transactional?: boolean
  type?: ExtensionTypeId<'action'>
  visible?: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>
}

const ACTION_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u

function defaultLabel(id: string): string {
  return id.split(/[.-]/u).map(part => `${part[0]?.toUpperCase() ?? ''}${part.slice(1)}`).join(' ')
}

export class ActionBuilder<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> {
  #definition?: Readonly<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>>
  readonly #id: string
  readonly #state: ActionBuilderState<TRecord, TInput, TResult, TActor, TTenant, TServices>

  constructor(id: string) {
    if (!ACTION_ID.test(id)) throw new Error('Actions require stable dot or dash separated IDs')
    this.#id = id
    this.#state = {
      authorize: null,
      handle: null,
      label: defaultLabel(id),
      mount: 'record',
    }
  }

  authorize(policy: ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['authorize']): this {
    this.#state.authorize = policy
    return this
  }

  badge(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.badge = value
    return this
  }

  color(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.color = value
    return this
  }

  disabled(condition: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>): this {
    this.#state.disabled = condition
    return this
  }

  failureNotification(notification: ActionFailureNotification<Context<TRecord, TActor, TTenant, TServices>>): this {
    this.#state.failureNotification = notification
    return this
  }

  action<TNextResult>(
    handler: ActionHandler<TRecord, TInput, TNextResult, TActor, TTenant, TServices>,
  ): ActionBuilder<TRecord, TInput, TNextResult, TActor, TTenant, TServices> {
    const builder = this as unknown as ActionBuilder<TRecord, TInput, TNextResult, TActor, TTenant, TServices>
    builder.#state.handle = handler
    return builder
  }

  icon(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.icon = value
    return this
  }

  label(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string>): this {
    this.#state.label = value
    return this
  }

  lifecycle(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['lifecycle']>): this {
    this.#state.lifecycle = value
    return this
  }

  modal(value: ActionModalOptions<Context<TRecord, TActor, TTenant, TServices>>): this {
    this.#state.modal = value
    return this
  }

  modalDescription(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.modal = { ...this.#state.modal, description: value }
    return this
  }

  modalHeading(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.modal = { ...this.#state.modal, heading: value }
    return this
  }

  modalWidth(value: NonNullable<ActionModalOptions<Context<TRecord, TActor, TTenant, TServices>>['width']>): this {
    this.#state.modal = { ...this.#state.modal, width: value }
    return this
  }

  mount(value: ActionMount): this {
    this.#state.mount = value
    return this
  }

  mutateInput(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['mutateInput']>): this {
    this.#state.mutateInput = value
    return this
  }

  notification(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['notification']>): this {
    this.#state.notification = value
    return this
  }

  rateLimit(value: ActionRateLimit<Context<TRecord, TActor, TTenant, TServices>>): this {
    this.#state.rateLimit = value
    return this
  }

  requiresConfirmation(message = 'Are you sure?'): this {
    this.#state.confirmation = message
    return this
  }

  sideEffects(value: NonNullable<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>['sideEffects']>): this {
    this.#state.sideEffects = value
    return this
  }

  size(value: ActionSize): this {
    this.#state.size = value
    return this
  }

  slideOver(value = true): this {
    this.#state.modal = { ...this.#state.modal, slideOver: value }
    return this
  }

  successNotification(notification: ActionSuccessNotification<TResult, Context<TRecord, TActor, TTenant, TServices>>): this {
    this.#state.successNotification = notification
    return this
  }

  tooltip(value: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, string | null>): this {
    this.#state.tooltip = value
    return this
  }

  transactional(value = true): this {
    this.#state.transactional = value
    return this
  }

  type(value: ExtensionTypeId<'action'>): this {
    this.#state.type = value
    return this
  }

  visible(condition: ActionResolvable<Context<TRecord, TActor, TTenant, TServices>, boolean>): this {
    this.#state.visible = condition
    return this
  }

  compile(): Readonly<ActionDefinition<TRecord, TInput, TResult, TActor, TTenant, TServices>> {
    if (this.#definition) return this.#definition
    if (this.#state.authorize === null) throw new Error(`Action "${this.#id}" requires authorization`)
    if (this.#state.handle === null) throw new Error(`Action "${this.#id}" requires a handler`)
    this.#definition = deepFreeze({
      ...this.#state,
      authorize: this.#state.authorize,
      handle: this.#state.handle,
      id: this.#id,
      kind: 'custom' as const,
    })
    Object.freeze(this.#state)
    return this.#definition
  }
}

export interface ResourceActionComposer<TRecord, TInput extends JsonObject, TActor, TTenant, TServices> {
  action(id: string): ActionBuilder<TRecord, TInput, unknown, TActor, TTenant, TServices>
}

export function createResourceActionComposer<TRecord, TInput extends JsonObject, TActor, TTenant, TServices>(): ResourceActionComposer<TRecord, TInput, TActor, TTenant, TServices> {
  return Object.freeze({
    action: (id: string) => new ActionBuilder<TRecord, TInput, unknown, TActor, TTenant, TServices>(id),
  })
}

export function defineAction<
  TRecordSource extends RecordTypeSource,
  TInputSource extends RecordTypeSource,
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
>(
  id: string,
  _sources: ContextTypeSources<TActorSource, TTenantSource, TServicesSource> & {
    readonly input: TInputSource
    readonly record: TRecordSource
  },
): ActionBuilder<
  RecordTypeValue<TRecordSource>,
  RecordTypeValue<TInputSource> & JsonObject,
  unknown,
  RuntimeTypeValue<TActorSource>,
  OptionalRuntimeTypeValue<TTenantSource>,
  OptionalRuntimeTypeValue<TServicesSource>
>
export function defineAction(id: string): ActionBuilder<unknown, JsonObject, unknown, unknown, unknown, unknown>
export function defineAction(id: string, _sources?: object): unknown {
  return new ActionBuilder(id)
}
