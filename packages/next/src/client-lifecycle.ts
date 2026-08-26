import { useEffect, useMemo, useRef } from 'react'

export function useStrictModeSafeDisposal<TValue extends object>(value: TValue, dispose: (current: TValue) => void): void {
  const generations = useRef(new WeakMap<object, number>())
  useEffect(() => {
    const generation = (generations.current.get(value) ?? 0) + 1
    generations.current.set(value, generation)
    return () => {
      globalThis.queueMicrotask(() => {
        if (generations.current.get(value) === generation) dispose(value)
      })
    }
  }, [dispose, value])
}

const abortController = (controller: AbortController): void => controller.abort()

export function useClientRequestController(): AbortController {
  const controller = useMemo(() => new AbortController(), [])
  useStrictModeSafeDisposal(controller, abortController)
  return controller
}
