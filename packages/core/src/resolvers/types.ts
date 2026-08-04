import type { JsonValue } from '../protocol/json'
import type { TranslationReference } from '../translations/contracts'
import type { FieldPath, FieldPathValue } from './paths'

export type ResolverDomain =
  | 'action'
  | 'column'
  | 'entry'
  | 'form'
  | 'notification'
  | 'page'
  | 'panel'
  | 'widget'

export type ClientExpressionOperator =
  | 'and'
  | 'coalesce'
  | 'equals'
  | 'get'
  | 'not'
  | 'or'

export type ClientExpressionNode =
  | JsonValue
  | { readonly operator: ClientExpressionOperator, readonly operands: readonly ClientExpressionNode[] }

export type ClientExpression<TValue extends JsonValue> = {
  readonly kind: 'client-expression'
  readonly expression: ClientExpressionNode
  readonly valueType?: TValue
}

export type NamedClientResolver<TValue extends JsonValue, TInput extends JsonValue = JsonValue> = {
  readonly kind: 'named-client-resolver'
  readonly name: string
  readonly input?: TInput
  readonly valueType?: TValue
}

export type LiteralResolver<TValue extends JsonValue> = {
  readonly kind: 'literal'
  readonly value: TValue
}

export type NullResolver = {
  readonly kind: 'null'
  readonly value: null
}

export type ResolverContextInput<
  TDomain extends ResolverDomain,
  TValues extends object,
  TRecord = undefined,
  TActor = undefined,
  TTenant = undefined,
  TServices = undefined,
> = {
  readonly domain: TDomain
  readonly values: TValues
  readonly record: TRecord
  readonly actor: TActor
  readonly tenant: TTenant
  readonly services: TServices
  readonly locale: string
}

export type ResolverContext<
  TDomain extends ResolverDomain,
  TValues extends object,
  TRecord = undefined,
  TActor = undefined,
  TTenant = undefined,
  TServices = undefined,
> = ResolverContextInput<TDomain, TValues, TRecord, TActor, TTenant, TServices> & {
  get<TPath extends FieldPath<TValues>>(path: TPath): FieldPathValue<TValues, TPath>
}

export type FormResolverContext<TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'form', TValues, TRecord, TActor, TTenant, TServices>

export type EntryResolverContext<TRecord extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'entry', TRecord, TRecord, TActor, TTenant, TServices>

export type ColumnResolverContext<TRecord extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'column', TRecord, TRecord, TActor, TTenant, TServices>

export type ActionResolverContext<TValues extends object, TRecord = undefined, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'action', TValues, TRecord, TActor, TTenant, TServices>

export type WidgetResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'widget', TState, undefined, TActor, TTenant, TServices>

export type PageResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'page', TState, undefined, TActor, TTenant, TServices>

export type PanelResolverContext<TState extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'panel', TState, undefined, TActor, TTenant, TServices>

export type NotificationResolverContext<TNotification extends object, TActor = undefined, TTenant = undefined, TServices = undefined> =
  ResolverContext<'notification', TNotification, undefined, TActor, TTenant, TServices>

export type RawServerCallback<TValue extends JsonValue, TContext> = (context: TContext) => TValue | Promise<TValue>

export type ExplicitServerResolver<TValue extends JsonValue, TContext> = {
  readonly kind: 'server-resolver'
  readonly id: string
  readonly dependencies: readonly string[]
  readonly resolve: RawServerCallback<TValue, TContext>
}

export type ServerValueResolver<TValue extends JsonValue, TContext> =
  | ExplicitServerResolver<TValue, TContext>
  | RawServerCallback<TValue, TContext>

export type Resolvable<TValue extends JsonValue, TContext> =
  | ClientExpression<TValue>
  | ExplicitServerResolver<TValue, TContext>
  | LiteralResolver<TValue>
  | NamedClientResolver<TValue>
  | NullResolver
  | RawServerCallback<TValue, TContext>
  | TranslationReference
  | TValue
  | null

export type ResolverComponentError = {
  readonly code: 'resolver_failed'
  readonly message: string
  readonly resolverId?: string
  readonly target: string
}

export type ServerResolverPatch = {
  readonly target: string
  readonly dependencies: readonly string[]
  readonly value?: JsonValue
  readonly error?: ResolverComponentError
}

export type ServerResolverBatchResult = {
  readonly scope: string
  readonly version: number
  readonly stale: boolean
  readonly patches: readonly ServerResolverPatch[]
}

export type ServerResolverBatchOptions = {
  readonly scope: string
  readonly version: number
  readonly requests: readonly ServerResolverRequest[]
  readonly environment?: 'development' | 'production'
}

export type ServerResolverRequest = {
  readonly target: string
  readonly resolverId?: string
  readonly explicitDependencies: readonly string[]
  run(observe: (path: string) => void): Promise<JsonValue>
}
