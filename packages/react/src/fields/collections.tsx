import { useEffect, useRef, type ReactNode } from 'react'
import type { CollectionStore, EditorAdapterInstance } from '@holo-js/panels-client'
import { FieldFrame, property, requireStore, updateField, useStoreState } from './shared'
import type { ReactFieldControlProps } from './types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function EditorField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const adapterId = typeof props.context.definition.properties.editorAdapter === 'string'
    ? props.context.definition.properties.editorAdapter
    : null
  const element = useRef<HTMLDivElement>(null)
  const instance = useRef<EditorAdapterInstance>(null)
  const value = asString(props.context.value)
  useEffect(() => {
    if (!adapterId || !element.current) return
    const registry = requireStore(props.editorAdapters, props.context.definition.type, 'EditorAdapterRegistry')
    const mounted = registry.resolve(adapterId, props.context.definition.path).mount({
      disabled: props.context.disabled,
      element: element.current,
      onChange: next => updateField(props, next),
      readOnly: props.context.readOnly,
      value,
    })
    instance.current = mounted
    return () => {
      mounted.destroy()
      instance.current = null
    }
  }, [adapterId, props.context.disabled, props.context.readOnly, props.editorAdapters])
  useEffect(() => instance.current?.update(value), [value])
  if (adapterId) return <FieldFrame context={props.context}><div ref={element} tabIndex={0} /></FieldFrame>
  return <FieldFrame context={props.context}><textarea
    disabled={props.context.disabled}
    onChange={event => updateField(props, event.currentTarget.value)}
    readOnly={props.context.readOnly}
    value={value}
  /></FieldFrame>
}

function CollectionActions<TValue>({ disabled, index, length, store }: {
  readonly disabled: boolean
  readonly index: number
  readonly length: number
  readonly store: CollectionStore<TValue>
}): ReactNode {
  return <span className="hp-collection-actions">
    <button aria-label={`Move item ${index + 1} up`} disabled={disabled || index === 0} onClick={() => store.move(index, index - 1)} type="button">↑</button>
    <button aria-label={`Move item ${index + 1} down`} disabled={disabled || index === length - 1} onClick={() => store.move(index, index + 1)} type="button">↓</button>
    <button aria-label={`Clone item ${index + 1}`} disabled={disabled} onClick={() => store.clone(index)} type="button">Clone</button>
    <button aria-label={`Remove item ${index + 1}`} disabled={disabled} onClick={() => store.delete(index)} type="button">Remove</button>
  </span>
}

export function ReactCollectionField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  if (['code', 'markdown', 'rich-editor'].includes(props.context.definition.type)) return <EditorField {...props} />
  if (props.context.definition.type === 'tags') {
    const separator = property(props.context, 'separator', ',')
    const value = Array.isArray(props.context.value) ? props.context.value.filter(item => typeof item === 'string').join(`${separator} `) : ''
    return <FieldFrame context={props.context}><input
      disabled={props.context.disabled}
      onChange={event => updateField(props, event.currentTarget.value.split(separator).map(item => item.trim()).filter(Boolean))}
      readOnly={props.context.readOnly}
      type="text"
      value={value}
    /></FieldFrame>
  }
  const store = requireStore(props.collectionStore, props.context.definition.type, 'CollectionStore')
  const state = useStoreState(store)
  useEffect(() => store.subscribe(() => updateField(props, store.values)), [store, props.store, props.context.definition.path])
  const maximum = property(props.context, 'maximumItems', null as number | null)
  const disabled = props.context.disabled || props.context.readOnly
  const blockDefinitions: readonly unknown[] = Array.isArray(props.context.definition.properties.blocks)
    ? props.context.definition.properties.blocks
    : []
  const add = (blockType?: string): void => {
    if (props.context.definition.type === 'key-value') store.add({ key: '', value: '' })
    else if (props.createCollectionItem) store.add(props.createCollectionItem(blockType))
  }
  return <div className="hp-field hp-collection" data-field-path={props.context.definition.path} data-field-type={props.context.definition.type}>
    {props.context.definition.label ? <div>{props.context.definition.label}</div> : null}
    <ol>
      {state.items.map((item, index) => <li key={item.key}>
        {props.context.definition.type === 'key-value' && typeof item.value === 'object' && item.value !== null
          ? <span>{asString(Reflect.get(item.value, 'key'))}: {asString(Reflect.get(item.value, 'value'))}</span>
          : props.context.definition.type === 'builder'
            ? props.renderBuilderBlock?.(item.value, index) ?? <span>{typeof Reflect.get(item.value as object, 'type') === 'string' ? String(Reflect.get(item.value as object, 'type')) : `Block ${index + 1}`}</span>
            : props.renderRepeaterItem?.(item.value, index) ?? <span>{`Item ${index + 1}`}</span>}
        <button aria-expanded={!item.collapsed} disabled={disabled} onClick={() => store.toggleCollapsed(index)} type="button">{item.collapsed ? 'Expand' : 'Collapse'}</button>
        <CollectionActions disabled={disabled} index={index} length={state.items.length} store={store} />
      </li>)}
    </ol>
    {props.context.definition.type === 'builder'
      ? blockDefinitions.map((definition, index) => {
          if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) return null
          const type = Reflect.get(definition, 'type')
          if (typeof type !== 'string') return null
          const label = Reflect.get(definition, 'label')
          return <button
            disabled={disabled || !props.createCollectionItem || (maximum !== null && state.items.length >= maximum)}
            key={type}
            onClick={() => add(type)}
            type="button"
          >Add {typeof label === 'string' ? label : `block ${index + 1}`}</button>
        })
      : <button
          disabled={disabled || (props.context.definition.type !== 'key-value' && !props.createCollectionItem) || (maximum !== null && state.items.length >= maximum)}
          onClick={() => add()}
          type="button"
        >Add item</button>}
    {props.context.errors.length > 0 ? <ul role="alert">{props.context.errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}
