export type RuntimeTypeSource =
  | BooleanConstructor
  | NumberConstructor
  | StringConstructor
  | { readonly prototype: object }

export type RuntimeTypeValue<TSource extends RuntimeTypeSource> =
  TSource extends BooleanConstructor ? boolean
    : TSource extends NumberConstructor ? number
      : TSource extends StringConstructor ? string
        : TSource extends { readonly prototype: infer TValue extends object } ? TValue
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
