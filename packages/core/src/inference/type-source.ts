export type RuntimeTypeSource =
  | BooleanConstructor
  | NumberConstructor
  | StringConstructor
  | RecordTypeSource

type RuntimeProjection<TValue extends object> =
  TValue extends { toJSON(): infer TResult }
    ? Awaited<TResult> extends object ? Awaited<TResult> : TValue
    : TValue

export type PublicRuntimeType<TValue extends object> = {
  [TKey in keyof RuntimeProjection<TValue>]: RuntimeProjection<TValue>[TKey]
}

type HiddenRuntimeKey<TSource> = TSource extends {
  readonly definition: { readonly hidden?: readonly (infer TKey)[] }
} ? string extends TKey ? never : Extract<TKey, string> : never

type SafeHiddenRuntimeKey<TSource, TValue extends object> =
  [keyof PublicRuntimeType<TValue>] extends [HiddenRuntimeKey<TSource>] ? never : HiddenRuntimeKey<TSource>

type RuntimeSourceValue<TSource, TValue extends object> =
  [SafeHiddenRuntimeKey<TSource, TValue>] extends [never]
    ? PublicRuntimeType<TValue>
    : Omit<PublicRuntimeType<TValue>, SafeHiddenRuntimeKey<TSource, TValue>>

export type RuntimeTypeValue<TSource extends RuntimeTypeSource> =
  TSource extends BooleanConstructor ? boolean
    : TSource extends NumberConstructor ? number
      : TSource extends StringConstructor ? string
        : TSource extends { readonly prototype: infer TValue extends object } ? RuntimeSourceValue<TSource, TValue>
          : TSource extends { create(...parameters: never[]): infer TResult extends object | Promise<object> }
            ? RuntimeSourceValue<TSource, Awaited<TResult>>
            : never

export type OptionalRuntimeTypeValue<TSource extends RuntimeTypeSource | undefined> =
  TSource extends RuntimeTypeSource ? RuntimeTypeValue<TSource> : unknown

export type RecordTypeSource =
  | { readonly prototype: object }
  | { create(...parameters: never[]): object | Promise<object> }

export type RecordTypeValue<TSource extends RecordTypeSource> =
  TSource extends { readonly prototype: infer TRecord extends object } ? TRecord
    : TSource extends { create(...parameters: never[]): infer TResult } ? Awaited<TResult> & object
      : never

export interface ContextTypeSources<
  TActorSource extends RuntimeTypeSource,
  TTenantSource extends RuntimeTypeSource | undefined = undefined,
  TServicesSource extends RuntimeTypeSource | undefined = undefined,
> {
  readonly actor: TActorSource
  readonly services?: TServicesSource
  readonly tenant?: TTenantSource
}
