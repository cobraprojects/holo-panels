import type { RelationDefinition } from '@holo-js/db'
import type { OptionQueryRequest, OptionValue } from '../fields/options'
import type {
  NormalizedRelationListRequest,
  RelationOperation,
  RelationPresentation,
  RelationRecordPage,
} from './presentation'

export type {
  NormalizedRelationListRequest,
  RelationListRequest,
  RelationOperation,
  RelationPresentation,
  RelationRecordPage,
} from './presentation'

export interface RelationManagerContext<TOwner, TActor extends object, TTenant> {
  readonly actor: TActor | null
  readonly owner: TOwner
  readonly signal: AbortSignal
  readonly tenant: TTenant
}

export interface RelationManagerAuthorization<TOwner, TRelated, TActor extends object, TTenant> {
  authorizeOwner(
    operation: RelationOperation,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<void>
  authorizeRelated(
    operation: RelationOperation,
    related: TRelated,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
  ): Promise<void>
}

export interface RelationManagerTransaction {
  run<TResult>(operation: () => Promise<TResult>): Promise<TResult>
}

export interface RelationOptionPage<TRelated> {
  readonly records: readonly TRelated[]
  readonly page: number
  readonly perPage: number
  readonly hasMore: boolean
  readonly total?: number
}

export interface RelationPersistence<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  createQuery(context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery
  scopeToOwner(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery
  applyTenantScope(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery
  applyAuthorizationScope(query: TQuery, context: RelationManagerContext<TOwner, TActor, TTenant>): TQuery
  list(
    query: TQuery,
    request: NormalizedRelationListRequest,
  ): Promise<RelationRecordPage<TRelated>>
  find(query: TQuery, id: TValue): Promise<TRelated | undefined>
  create(input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>
  update(related: TRelated, input: TInput, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<TRelated>
  delete(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  associate?(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  dissociate?(related: TRelated | undefined, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  attach?(related: TRelated, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  detach?(related: TRelated, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  updatePivot?(related: TRelated, pivot: TPivot, context: RelationManagerContext<TOwner, TActor, TTenant>): Promise<void>
  listOptions?(
    request: OptionQueryRequest<TValue>,
    context: RelationManagerContext<TOwner, TActor, TTenant>,
    signal?: AbortSignal,
  ): Promise<RelationOptionPage<TRelated>>
  hydrateOptions?(
    request: OptionQueryRequest<TValue>,
    selected: readonly TValue[],
    context: RelationManagerContext<TOwner, TActor, TTenant>,
    signal?: AbortSignal,
  ): Promise<readonly TRelated[]>
  optionValue?(record: TRelated): TValue
  optionLabel?(record: TRelated): string
}

export interface RelationValidation<TValue, TContext> {
  validate(value: TValue, context: TContext): Promise<void>
}

export interface RelationManagerDefinition<
  TOwner,
  TRelated,
  TQuery,
  TInput extends Readonly<Record<string, unknown>>,
  TPivot extends Readonly<Record<string, unknown>>,
  TValue extends OptionValue,
  TActor extends object,
  TTenant,
> {
  readonly id: string
  readonly relationName: string
  readonly relation: RelationDefinition
  readonly operations: readonly RelationOperation[]
  readonly presentation: RelationPresentation
  readonly group: string | null
  readonly badge: ((context: RelationManagerContext<TOwner, TActor, TTenant>) => string | number | Promise<string | number>) | null
  readonly visible: (context: RelationManagerContext<TOwner, TActor, TTenant>) => boolean | Promise<boolean>
  readonly persistence: RelationPersistence<TOwner, TRelated, TQuery, TInput, TPivot, TValue, TActor, TTenant>
  readonly authorization: RelationManagerAuthorization<TOwner, TRelated, TActor, TTenant>
  readonly transaction: RelationManagerTransaction
  readonly inputValidation?: RelationValidation<TInput, RelationManagerContext<TOwner, TActor, TTenant>>
  readonly pivotValidation?: RelationValidation<TPivot, RelationManagerContext<TOwner, TActor, TTenant>>
  readonly writableInputFields: readonly Extract<keyof TInput, string>[]
  readonly writablePivotFields: readonly Extract<keyof TPivot, string>[]
}
