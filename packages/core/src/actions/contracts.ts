import type { JsonObject } from '../protocol/json'
import type { PanelNotificationPresentation } from '../notifications/contracts'
import type { Effect } from '../protocol/effects'
import type { CompiledSchema, RenderSlotReference, SchemaManifest } from '../schemas/contracts'
import type { ExtensionTypeId } from '../plugins/type-id'

export type ActionKind = 'associate' | 'attach' | 'create' | 'custom' | 'delete' | 'detach' | 'dissociate' | 'edit' | 'editPivot' | 'force-delete' | 'replicate' | 'restore' | 'view'
export type ActionMount = 'bulk' | 'modal' | 'notification' | 'page' | 'record'

export interface ActionContext<TRecord, TActor, TTenant, TServices> {
  readonly actor: TActor
  readonly mount: ActionMount
  readonly record: TRecord | null
  readonly services: TServices
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export type ActionResolvable<TContext, TValue> = TValue | ((context: TContext) => TValue | Promise<TValue>)

export type ActionSuccessNotification<TResult, TContext> = Readonly<PanelNotificationPresentation> | ((result: TResult, context: TContext) => Readonly<PanelNotificationPresentation> | null | Promise<Readonly<PanelNotificationPresentation> | null>)
export type ActionFailureNotification<TContext> = Readonly<PanelNotificationPresentation> | ((context: TContext) => Readonly<PanelNotificationPresentation> | null | Promise<Readonly<PanelNotificationPresentation> | null>)

export interface ActionResolvedState {
  readonly disabled: boolean
  readonly label: string
  readonly visible: boolean
}

export type ActionModalWidth = 'small' | 'medium' | 'large' | 'extra-large' | 'screen'
export type ActionSize = 'extra-small' | 'small' | 'medium' | 'large' | 'extra-large'

export interface ActionModalOptions<TContext> {
  readonly content?: RenderSlotReference
  readonly description?: ActionResolvable<TContext, string | null>
  readonly footer?: RenderSlotReference
  readonly heading?: ActionResolvable<TContext, string | null>
  readonly nestedActions?: readonly string[]
  readonly schema?: CompiledSchema<JsonObject, TContext>
  readonly slideOver?: boolean
  readonly width?: ActionModalWidth
}

export interface ActionModalManifest {
  readonly content: RenderSlotReference | null
  readonly description: string | null
  readonly footer: RenderSlotReference | null
  readonly heading: string | null
  readonly nestedActions: readonly string[]
  readonly schema: SchemaManifest<JsonObject> | null
  readonly slideOver: boolean
  readonly width: ActionModalWidth
}

export interface ActionRateLimit<TContext> {
  readonly key: (context: TContext) => string | Promise<string>
  readonly limit: number
  readonly windowMilliseconds: number
}

export interface ActionPresentationDefinition<TRecord, TActor, TTenant, TServices> {
  readonly badge?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly color?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly icon?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly modal?: ActionModalOptions<ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly rateLimit?: ActionRateLimit<ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly size?: ActionSize
  readonly tooltip?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string | null>
  readonly type?: ExtensionTypeId<'action'>
}

export interface ActionPresentationManifest {
  readonly badge: string | null
  readonly color: string | null
  readonly icon: string | null
  readonly modal: ActionModalManifest | null
  readonly size: ActionSize
  readonly tooltip: string | null
  readonly type: string
}

export interface ActionDefinition<TRecord, TInput extends JsonObject, TResult, TActor, TTenant, TServices> extends ActionPresentationDefinition<TRecord, TActor, TTenant, TServices> {
  readonly authorize: (context: ActionContext<TRecord, TActor, TTenant, TServices>, input: Readonly<TInput>) => boolean | Promise<boolean>
  readonly confirmation?: string | null
  readonly disabled?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, boolean>
  readonly failureNotification?: ActionFailureNotification<ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly handle: (input: TInput, context: ActionContext<TRecord, TActor, TTenant, TServices>) => TResult | Promise<TResult>
  readonly id: string
  readonly kind: ActionKind
  readonly label: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, string>
  readonly lifecycle?: {
    readonly after?: (result: TResult, context: ActionContext<TRecord, TActor, TTenant, TServices>) => void | Promise<void>
    readonly before?: (input: TInput, context: ActionContext<TRecord, TActor, TTenant, TServices>) => void | Promise<void>
  }
  readonly mount: ActionMount
  readonly mutateInput?: (input: TInput, context: ActionContext<TRecord, TActor, TTenant, TServices>) => TInput | Promise<TInput>
  readonly notification?: (result: TResult, context: ActionContext<TRecord, TActor, TTenant, TServices>) => JsonObject | null | Promise<JsonObject | null>
  readonly sideEffects?: readonly ((result: TResult, context: ActionContext<TRecord, TActor, TTenant, TServices>) => void | Promise<void>)[]
  readonly successNotification?: ActionSuccessNotification<TResult, ActionContext<TRecord, TActor, TTenant, TServices>>
  readonly transactional?: boolean
  readonly visible?: ActionResolvable<ActionContext<TRecord, TActor, TTenant, TServices>, boolean>
}

export interface ActionManifest extends ActionPresentationManifest {
  confirmation: string | null
  disabled: boolean
  id: string
  kind: ActionKind
  label: string
  mount: ActionMount
  visible: boolean
}

export interface ActionGroupManifest {
  readonly actions: readonly string[]
  readonly color: string | null
  readonly icon: string | null
  readonly id: string
  readonly label: string | null
}

export interface ActionGroupItem {
  readonly id: string
}

export interface ActionRecordResolver<TRecord, TRecordId extends number | string, TActor, TTenant> {
  resolve(id: TRecordId, scope: { readonly actor: TActor, readonly signal: AbortSignal, readonly tenant: TTenant }): Promise<TRecord | null>
  version(record: TRecord): string | null
}

export interface ActionTransaction {
  run<TResult>(operation: () => Promise<TResult>): Promise<TResult>
}

export interface ActionNotificationSender<TActor, TTenant> {
  send(notification: JsonObject, context: { readonly actor: TActor, readonly tenant: TTenant }): Promise<void>
}

export interface ActionExecutionRequest<TInput extends JsonObject, TRecordId extends number | string> {
  readonly expectedVersions?: Readonly<Record<string, string>>
  readonly idempotencyKey: string
  readonly input: TInput
  readonly mount: ActionMount
  readonly recordIds?: readonly TRecordId[]
}

export type ActionItemStatus = 'denied' | 'failed' | 'stale' | 'succeeded'

export interface ActionItemResult<TRecordId extends number | string, TResult> {
  readonly recordId: TRecordId
  readonly result?: TResult
  readonly status: ActionItemStatus
}

export interface ActionExecutionResult<TRecordId extends number | string, TResult> {
  readonly effects: readonly Effect[]
  readonly items: readonly ActionItemResult<TRecordId, TResult>[]
  readonly result?: TResult
  readonly status: 'partial' | 'succeeded'
}

export interface ActionEngineOptions<TRecord, TRecordId extends number | string, TActor, TTenant> {
  readonly notifications?: ActionNotificationSender<TActor, TTenant>
  readonly records: ActionRecordResolver<TRecord, TRecordId, TActor, TTenant>
  readonly transaction: ActionTransaction
}
