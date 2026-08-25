import { cloneVNode, computed, getCurrentScope, h, onScopeDispose, shallowRef, useId, type ComputedRef, type VNode, type VNodeChild } from 'vue'
import { Field, FieldDescription, FieldError, FieldLabel } from '../internal-ui'
import type { VueFieldControlProps, VueFieldPath, VueFieldRenderContext, VueFieldRendererProps, VueFieldValue } from './types'

export function fieldValue(values: object, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (Array.isArray(value)) return value[Number(segment)]
    if (typeof value === 'object' && value !== null) return Reflect.get(value, segment)
    return undefined
  }, values)
}

export function useFieldContext<TValues extends object, TPath extends VueFieldPath<TValues>>(
  props: VueFieldRendererProps<TValues, TPath>,
): ComputedRef<VueFieldRenderContext<TValues, TPath> | null> {
  const generatedId = useId().replaceAll(':', '')
  const state = shallowRef(props.store.state)
  const unsubscribe = props.store.subscribe(next => { state.value = next })
  if (getCurrentScope()) onScopeDispose(unsubscribe)
  return computed(() => {
    const path = props.definition.path
    const visible = state.value.visibility[path] ?? props.definition.visible
    if (!visible) return null
    return {
      definition: props.definition,
      disabled: state.value.disabled[path] ?? props.definition.disabled,
      errors: state.value.errors[path] ?? [],
      inputId: `hp-field-${generatedId}`,
      readOnly: state.value.readOnly[path] ?? props.definition.readOnly,
      value: fieldValue(state.value.values, path) as VueFieldValue<TValues, TPath>,
    }
  })
}

export function updateField<TValues extends object>(props: VueFieldRendererProps<TValues>, value: unknown): void {
  props.store.batch([{ kind: 'set', path: props.definition.path, value, touch: true }])
}

export function touchField<TValues extends object>(props: VueFieldRendererProps<TValues>): void {
  props.store.batch([{ kind: 'touch', path: props.definition.path }])
}

export function property<TValues extends object, TValue>(
  context: VueFieldRenderContext<TValues>,
  name: string,
  fallback: TValue,
): TValue {
  const value = context.definition.properties[name]
  return typeof value === typeof fallback ? value as TValue : fallback
}

export function fieldFrame<TValues extends object>(
  context: VueFieldRenderContext<TValues>,
  control: VNode,
  adornments: { readonly after?: VNodeChild, readonly before?: VNodeChild } = {},
): VNode {
  const description = context.definition.helperText ?? context.definition.hint
  const descriptionId = description ? `${context.inputId}-description` : undefined
  const errorId = context.errors.length > 0 ? `${context.inputId}-errors` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  return h(Field, {
    class: 'hp-field',
    'data-field-path': context.definition.path,
    'data-field-type': context.definition.type,
  }, () => [
    context.definition.label ? h(FieldLabel, { for: context.inputId }, () => [
      context.definition.label,
      context.definition.required ? h('span', { 'aria-hidden': 'true' }, ' *') : null,
    ]) : null,
    description ? h(FieldDescription, { id: descriptionId }, () => description) : null,
    adornments.before,
    cloneVNode(control, {
      id: context.inputId,
      'aria-describedby': describedBy,
      'aria-invalid': context.errors.length > 0 ? 'true' : undefined,
      'aria-required': context.definition.required ? 'true' : undefined,
    }),
    adornments.after,
    context.errors.length > 0 ? h(FieldError, { errors: context.errors.map(message => ({ message })), id: errorId }) : null,
  ])
}

export function requireStore<TStore>(store: TStore | undefined, fieldType: string, storeName: string): TStore {
  if (!store) throw new Error(`[Holo Panels] Vue ${fieldType} fields require a ${storeName}.`)
  return store
}

export type VueFieldControl<TValues extends object> = (props: VueFieldControlProps<TValues>) => VNode
