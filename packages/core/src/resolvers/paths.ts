type AtomicValue = bigint | boolean | Date | null | number | string | symbol | undefined

type PreviousDepth = [never, 0, 1, 2, 3, 4, 5, 6]

type NestedPath<TValue, TDepth extends number> = TDepth extends 0
  ? never
  : TValue extends AtomicValue | ((...parameters: never[]) => unknown)
    ? never
    : TValue extends readonly (infer TItem)[]
      ? `${number}` | `${number}.${NestedPath<TItem, PreviousDepth[TDepth]>}`
      : TValue extends object
        ? {
            [TKey in Extract<keyof TValue, string>]: TValue[TKey] extends AtomicValue | ((...parameters: never[]) => unknown)
              ? TKey
              : TKey | `${TKey}.${NestedPath<TValue[TKey], PreviousDepth[TDepth]>}`
          }[Extract<keyof TValue, string>]
        : never

export type FieldPath<TValues extends object> = NestedPath<TValues, 6>

export type FieldPathValue<TValue, TPath extends string> = TPath extends `${infer THead}.${infer TTail}`
  ? THead extends keyof TValue
    ? FieldPathValue<TValue[THead], TTail>
    : TValue extends readonly (infer TItem)[]
      ? THead extends `${number}`
        ? FieldPathValue<TItem, TTail>
        : never
      : never
  : TPath extends keyof TValue
    ? TValue[TPath]
    : TValue extends readonly (infer TItem)[]
      ? TPath extends `${number}`
        ? TItem
        : never
      : never

export function readFieldPath<TValues extends object, TPath extends FieldPath<TValues>>(
  values: TValues,
  path: TPath,
): FieldPathValue<TValues, TPath> {
  let current: object | AtomicValue = values
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined as FieldPathValue<TValues, TPath>
    if (!Object.prototype.hasOwnProperty.call(current, segment)) return undefined as FieldPathValue<TValues, TPath>
    current = (current as Record<string, object | AtomicValue>)[segment]
  }
  return current as FieldPathValue<TValues, TPath>
}
