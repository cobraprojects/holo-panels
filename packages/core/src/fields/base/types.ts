import type { FieldDefinition, FormSchema, InferFormData } from '@holo-js/forms'
import type { JsonObject, JsonValue } from '../../protocol/json'

type AtomicFieldValue = Blob | Date | bigint | boolean | number | string | symbol | null | undefined

export type FormFieldPath<TValues> = TValues extends AtomicFieldValue
  ? never
  : TValues extends readonly (infer TItem)[]
    ? `${number}` | `${number}.${FormFieldPath<TItem>}`
    : TValues extends object
      ? {
          [TKey in keyof TValues & string]: TValues[TKey] extends AtomicFieldValue
            ? TKey
            : NonNullable<TValues[TKey]> extends readonly (infer TItem)[]
                ? TKey | `${TKey}.${number}` | `${TKey}.${number}.${FormFieldPath<TItem>}`
                : `${TKey}.${FormFieldPath<TValues[TKey]>}`
        }[keyof TValues & string]
      : never

export type FormFieldValue<TValues, TPath extends string> = TPath extends keyof TValues
  ? TValues[TPath]
  : TValues extends readonly (infer TItem)[]
    ? TPath extends `${number}.${infer TTail}`
      ? FormFieldValue<TItem, TTail>
      : TPath extends `${number}`
        ? TItem
        : never
    : TPath extends `${infer THead}.${infer TTail}`
      ? THead extends keyof TValues
        ? FormFieldValue<TValues[THead], TTail>
        : never
      : never

export type FormFieldPathFor<TValues, TValue> = {
  [TPath in FormFieldPath<TValues>]: NonNullable<FormFieldValue<TValues, TPath>> extends TValue ? TPath : never
}[FormFieldPath<TValues>]

export type FormValues<TSchema extends FormSchema> = InferFormData<TSchema>

export interface BoundFormField<TValues, TPath extends FormFieldPath<TValues>> {
  readonly path: TPath
  readonly schema: FieldDefinition
}

export type FieldOperation = 'create' | 'edit' | 'view' | 'action' | 'filter'

export interface FieldResolverContext<TValues, TPath extends FormFieldPath<TValues>, TRecord = unknown> {
  readonly operation: FieldOperation
  readonly path: TPath
  readonly value: FormFieldValue<TValues, TPath>
  readonly values: Readonly<TValues>
  readonly record?: TRecord
  get<TDependencyPath extends FormFieldPath<TValues>>(
    path: TDependencyPath,
  ): FormFieldValue<TValues, TDependencyPath>
}

export type FieldResolver<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown> = (
  context: FieldResolverContext<TValues, TPath, TRecord>,
) => TValue | Promise<TValue>

export type FieldResolvable<TValues, TPath extends FormFieldPath<TValues>, TValue, TRecord = unknown> =
  | TValue
  | FieldResolver<TValues, TPath, TValue, TRecord>

export interface FieldLayout {
  readonly columnSpan?: number | 'full'
  readonly columnStart?: number
}

export interface FieldClientHints {
  readonly kind: FieldDefinition['kind']
  readonly required: boolean
  readonly nullable: boolean
  readonly minimum?: number
  readonly maximum?: number
  readonly exactSize?: number
  readonly format?: 'email' | 'url'
  readonly allowedValues?: readonly JsonValue[]
}

export interface FieldStateCodec<TValue, THydrated = TValue, TDehydrated = TValue> {
  hydrate(value: TValue | null | undefined): THydrated
  dehydrate(value: THydrated): TDehydrated | undefined
}

export interface FieldPresentationState<TValue> {
  readonly value: TValue
  readonly errors: readonly string[]
  readonly visible: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly label: string | null
  readonly helperText: string | null
  readonly hint: string | null
  readonly placeholder: string | null
}

export interface CompiledFieldDefinition<
  TValues,
  TPath extends FormFieldPath<TValues>,
  TValue,
  TRecord = unknown,
> {
  readonly kind: 'field'
  readonly type: string
  readonly path: TPath
  readonly label: string | null
  readonly helperText: string | null
  readonly hint: string | null
  readonly placeholder: string | null
  readonly defaultValue?: TValue
  readonly visible: boolean
  readonly disabled: boolean
  readonly readOnly: boolean
  readonly required: boolean
  readonly dependencies: readonly FormFieldPath<TValues>[]
  readonly debounceMilliseconds: number
  readonly layout: FieldLayout
  readonly extraAttributes: JsonObject
  readonly properties: JsonObject
  readonly clientHints: FieldClientHints
  readonly server: {
    readonly label?: FieldResolver<TValues, TPath, string | null, TRecord>
    readonly helperText?: FieldResolver<TValues, TPath, string | null, TRecord>
    readonly hint?: FieldResolver<TValues, TPath, string | null, TRecord>
    readonly placeholder?: FieldResolver<TValues, TPath, string | null, TRecord>
    readonly defaultValue?: FieldResolver<TValues, TPath, TValue, TRecord>
    readonly visible?: FieldResolver<TValues, TPath, boolean, TRecord>
    readonly disabled?: FieldResolver<TValues, TPath, boolean, TRecord>
    readonly readOnly?: FieldResolver<TValues, TPath, boolean, TRecord>
    readonly hydrate?: FieldResolver<TValues, TPath, TValue, TRecord>
    readonly dehydrate?: FieldResolver<TValues, TPath, TValue | undefined, TRecord>
  }
}
