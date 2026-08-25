import type { SchemaManifest } from '@holo-js/panels-core'

export type FormPath<TValue> = TValue extends readonly (infer TItem)[]
  ? `${number}` | `${number}.${FormPath<TItem>}`
  : TValue extends object
    ? {
        [TKey in keyof TValue & string]: TValue[TKey] extends object
          ? TKey | `${TKey}.${FormPath<TValue[TKey]>}`
          : TKey
      }[keyof TValue & string]
    : never

export type FormValueAtPath<TValue, TPath extends string> = TPath extends keyof TValue
  ? TValue[TPath]
  : TValue extends readonly (infer TItem)[]
    ? TPath extends `${number}.${infer TTail}`
      ? FormValueAtPath<TItem, TTail>
      : TPath extends `${number}`
        ? TItem
        : never
    : TPath extends `${infer THead}.${infer TTail}`
      ? THead extends keyof TValue
        ? FormValueAtPath<TValue[THead], TTail>
        : never
      : never

export type FormErrorBag = Readonly<Record<string, readonly string[]>>
export type FormFieldFlagMap = Readonly<Record<string, boolean>>

export interface FormFocusMetadata {
  readonly path: string
  readonly componentId?: string
  readonly requestVersion?: number
}

export interface FormState<TValues> {
  readonly values: TValues
  readonly initialValues: TValues
  readonly dirtyPaths: readonly string[]
  readonly touchedPaths: readonly string[]
  readonly errors: FormErrorBag
  readonly visibility: FormFieldFlagMap
  readonly disabled: FormFieldFlagMap
  readonly readOnly: FormFieldFlagMap
  readonly pending: FormFieldFlagMap
  readonly validating: boolean
  readonly submitting: boolean
  readonly focus?: FormFocusMetadata
  readonly version: number
}

export type FormOperation =
  | { readonly kind: 'set', readonly path: string, readonly value: unknown, readonly touch?: boolean }
  | { readonly kind: 'touch', readonly path: string, readonly touched?: boolean }
  | { readonly kind: 'errors', readonly path: string, readonly errors: readonly string[] }
  | { readonly kind: 'visible', readonly path: string, readonly value: boolean }
  | { readonly kind: 'disabled', readonly path: string, readonly value: boolean }
  | { readonly kind: 'read-only', readonly path: string, readonly value: boolean }
  | { readonly kind: 'pending', readonly path: string, readonly value: boolean }
  | { readonly kind: 'array-insert', readonly path: string, readonly index: number, readonly value: unknown }
  | { readonly kind: 'array-remove', readonly path: string, readonly index: number }
  | { readonly kind: 'array-move', readonly path: string, readonly from: number, readonly to: number }

export interface FormDependencyContext<TValues> {
  readonly changedPaths: ReadonlySet<string>
  readonly touchedPaths: ReadonlySet<string>
  get<TPath extends FormPath<TValues>>(path: TPath): FormValueAtPath<TValues, TPath>
}

export interface FormDependency<TValues> {
  readonly id: string
  readonly paths: readonly FormPath<TValues>[]
  recompute(context: FormDependencyContext<TValues>): readonly FormOperation[]
}

export interface FormRequestContext<TValues> {
  readonly values: TValues
  readonly version: number
  readonly signal: AbortSignal
  get<TPath extends FormPath<TValues>>(path: TPath): FormValueAtPath<TValues, TPath>
}

export interface FormServerPatch {
  readonly operations?: readonly FormOperation[]
  readonly errors?: Readonly<Record<string, string | readonly string[]>>
  readonly focusFirstError?: boolean
  readonly commitValues?: boolean
}

export type FormValidationResponse = FormServerPatch

export type FormSubmitResponse = FormServerPatch

export interface FormRequestResult {
  readonly status: 'aborted' | 'applied' | 'stale'
  readonly version: number
}

export interface FormStoreOptions<TValues> {
  readonly schema?: SchemaManifest<TValues>
  readonly dependencies?: readonly FormDependency<TValues>[]
}

export type FormStateListener<TValues> = (
  state: FormState<TValues>,
  previous: FormState<TValues>,
) => void
