export type DeepReadonly<TValue> = TValue extends string | number | boolean | bigint | symbol | null | undefined
  ? TValue
  : TValue extends (...parameters: never[]) => unknown
  ? TValue
  : TValue extends readonly (infer TItem)[]
    ? readonly DeepReadonly<TItem>[]
    : TValue extends object
      ? string extends keyof TValue
        ? TValue
        : { readonly [TKey in keyof TValue]: DeepReadonly<TValue[TKey]> }
      : TValue

export function deepFreeze<TValue>(value: TValue): DeepReadonly<TValue> {
  const visited = new WeakSet<object>()

  function freeze(current: object): void {
    if (visited.has(current)) {
      return
    }

    visited.add(current)

    for (const child of Reflect.ownKeys(current).map(key => Reflect.get(current, key))) {
      if ((typeof child === 'object' && child !== null) || typeof child === 'function') {
        freeze(child)
      }
    }

    Object.freeze(current)
  }

  if ((typeof value === 'object' && value !== null) || typeof value === 'function') {
    freeze(value)
  }

  return value as DeepReadonly<TValue>
}
