import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { useFormStore, usePanelsStore } from '../store'
import type { FormPath, FormValueAtPath } from '@holo-js/panels-client'
import type { ReactFieldControlProps, ReactFieldRenderContext, ReactFieldRendererProps } from './types'

export function fieldValue(values: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) return value[Number(segment)]
    if (typeof value === 'object' && value !== null) return Reflect.get(value, segment)
    return undefined
  }, values)
}

export function useFieldContext<TValues extends object, TPath extends FormPath<TValues>>(
  props: ReactFieldRendererProps<TValues, TPath>,
): ReactFieldRenderContext<TValues, TPath> | null {
  const generatedId = useId()
  const state = useFormStore(props.store)
  const path = props.definition.path
  const visible = state.visibility[path] ?? props.definition.visible
  if (!visible) return null
  return {
    definition: props.definition,
    disabled: state.disabled[path] ?? props.definition.disabled,
    errors: state.errors[path] ?? [],
    inputId: `hp-field-${generatedId.replaceAll(':', '')}`,
    readOnly: state.readOnly[path] ?? props.definition.readOnly,
    value: fieldValue(state.values, path) as FormValueAtPath<TValues, TPath>,
  }
}

export function updateField<TValues extends object>(props: ReactFieldRendererProps<TValues>, value: unknown): void {
  props.store.batch([{ kind: 'set', path: props.definition.path, value, touch: true }])
}

export function touchField<TValues extends object>(props: ReactFieldRendererProps<TValues>): void {
  props.store.batch([{ kind: 'touch', path: props.definition.path }])
}

export function property<TValues extends object, TValue>(context: ReactFieldRenderContext<TValues>, name: string, fallback: TValue): TValue {
  const value = context.definition.properties[name]
  return typeof value === typeof fallback ? value as TValue : fallback
}

export function FieldFrame<TValues extends object>({ after, before, children, context }: {
  readonly after?: ReactNode
  readonly before?: ReactNode
  readonly children: ReactElement
  readonly context: ReactFieldRenderContext<TValues>
}): ReactNode {
  const description = context.definition.helperText ?? context.definition.hint
  const descriptionId = description ? `${context.inputId}-description` : undefined
  const errorId = context.errors.length > 0 ? `${context.inputId}-errors` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const control = {
    ...children.props as object,
    'aria-describedby': describedBy,
    'aria-invalid': context.errors.length > 0 || undefined,
    'aria-required': context.definition.required || undefined,
    id: context.inputId,
  }
  return <div className="hp-field" data-field-path={context.definition.path} data-field-type={context.definition.type}>
    {context.definition.label ? <label htmlFor={context.inputId}>{context.definition.label}{context.definition.required ? <span aria-hidden="true"> *</span> : null}</label> : null}
    {description ? <div id={descriptionId}>{description}</div> : null}
    {before || after
      ? <div className="hp-field-control">{before}{cloneElement(children, control)}{after}</div>
      : cloneElement(children, control)}
    {context.errors.length > 0 ? <ul id={errorId} role="alert">{context.errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul> : null}
  </div>
}

export function useStoreState<TState>(store: { readonly state: TState, subscribe(listener: () => void): () => void }): TState {
  return usePanelsStore({ getSnapshot: () => store.state, subscribe: listener => store.subscribe(listener) })
}

export function requireStore<TStore>(store: TStore | undefined, fieldType: string, storeName: string): TStore {
  if (!store) throw new Error(`[Holo Panels] React ${fieldType} fields require a ${storeName}.`)
  return store
}

export type FieldControl<TValues extends object> = (props: ReactFieldControlProps<TValues>) => ReactNode
