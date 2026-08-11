import { useEffect, useRef, type ReactNode } from 'react'
import type { CollectionStore, EditorAdapterInstance } from '@holo-js/panels-client'
import { ShadcnButton, ShadcnInput, ShadcnTextarea } from '../internal-ui'
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
  return <FieldFrame context={props.context}><ShadcnTextarea
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
    <ShadcnButton aria-label={`Move item ${index + 1} up`} disabled={disabled || index === 0} onClick={() => store.move(index, index - 1)} type="button">↑</ShadcnButton>
    <ShadcnButton aria-label={`Move item ${index + 1} down`} disabled={disabled || index === length - 1} onClick={() => store.move(index, index + 1)} type="button">↓</ShadcnButton>
    <ShadcnButton aria-label={`Clone item ${index + 1}`} disabled={disabled} onClick={() => store.clone(index)} type="button">Clone</ShadcnButton>
    <ShadcnButton aria-label={`Remove item ${index + 1}`} disabled={disabled} onClick={() => store.delete(index)} type="button">Remove</ShadcnButton>
  </span>
}

function KeyValueEditor({ disabled, index, store, value }: {
  readonly disabled: boolean
  readonly index: number
  readonly store: CollectionStore<unknown>
  readonly value: unknown
}): ReactNode {
  const key = typeof value === 'object' && value !== null ? asString(Reflect.get(value, 'key')) : ''
  const entryValue = typeof value === 'object' && value !== null ? asString(Reflect.get(value, 'value')) : ''
  return <span className="hp-key-value-entry">
    <ShadcnInput aria-label={`Key ${index + 1}`} disabled={disabled} onChange={event => store.replace(index, { key: event.currentTarget.value, value: entryValue })} value={key} />
    <ShadcnInput aria-label={`Value ${index + 1}`} disabled={disabled} onChange={event => store.replace(index, { key, value: event.currentTarget.value })} value={entryValue} />
  </span>
}

interface NestedField {
  readonly label: string
  readonly path: string
  readonly required: boolean
  readonly type: string
}

function nestedFields(value: unknown): readonly NestedField[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const label = Reflect.get(item, 'label')
    const path = Reflect.get(item, 'path')
    const type = Reflect.get(item, 'type')
    return typeof label === 'string' && typeof path === 'string' && typeof type === 'string'
      ? [{ label, path, required: Reflect.get(item, 'required') === true, type }]
      : []
  })
}

function nestedValue(value: unknown, path: string): unknown {
  let current = value
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
    current = Reflect.get(current, segment)
  }
  return current
}

function withNestedValue(value: unknown, path: string, next: unknown): Record<string, unknown> {
  const result = value && typeof value === 'object' && !Array.isArray(value) ? structuredClone(value) as Record<string, unknown> : {}
  const segments = path.split('.')
  let target = result
  for (const segment of segments.slice(0, -1)) {
    const child = target[segment]
    const object = child && typeof child === 'object' && !Array.isArray(child) ? child as Record<string, unknown> : {}
    target[segment] = object
    target = object
  }
  const final = segments.at(-1)
  if (final) target[final] = next
  return result
}

function NestedFieldsEditor({ definitions, disabled, onChange, value }: {
  readonly definitions: readonly NestedField[]
  readonly disabled: boolean
  readonly onChange: (value: Record<string, unknown>) => void
  readonly value: unknown
}): ReactNode {
  return <div className="hp-collection-fields">{definitions.map((field) => {
    const current = nestedValue(value, field.path)
    const checkbox = field.type === 'toggle' || field.type === 'checkbox'
    return <label key={field.path}>{field.label}<ShadcnInput
      checked={checkbox ? current === true : undefined}
      disabled={disabled}
      onChange={event => onChange(withNestedValue(value, field.path, checkbox ? event.currentTarget.checked : event.currentTarget.value))}
      required={field.required}
      type={checkbox ? 'checkbox' : 'text'}
      value={checkbox ? undefined : typeof current === 'number' || typeof current === 'string' ? current : ''}
    /></label>
  })}</div>
}

export function ReactCollectionField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  if (['code', 'markdown', 'rich-editor'].includes(props.context.definition.type)) return <EditorField {...props} />
  if (props.context.definition.type === 'tags') {
    const separator = property(props.context, 'separator', ',')
    const value = Array.isArray(props.context.value) ? props.context.value.filter(item => typeof item === 'string').join(`${separator} `) : ''
    return <FieldFrame context={props.context}><ShadcnInput
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
  const repeaterFields = nestedFields(props.context.definition.properties.fields)
  const add = (blockType?: string): void => {
    if (props.context.definition.type === 'key-value') store.add({ key: '', value: '' })
    else if (props.createCollectionItem) store.add(props.createCollectionItem(blockType))
  }
  return <div className="hp-field hp-collection" data-field-path={props.context.definition.path} data-field-type={props.context.definition.type}>
    {props.context.definition.label ? <div>{props.context.definition.label}</div> : null}
    <ol>
      {state.items.map((item, index) => <li key={item.key}>
        {!item.collapsed ? props.context.definition.type === 'key-value'
          ? <KeyValueEditor disabled={disabled} index={index} store={store} value={item.value} />
          : props.context.definition.type === 'builder'
            ? props.renderBuilderBlock?.(item.value, index) ?? (() => {
                const type = item.value && typeof item.value === 'object' && !Array.isArray(item.value) ? Reflect.get(item.value, 'type') : null
                const block = blockDefinitions.find(definition => definition && typeof definition === 'object' && !Array.isArray(definition) && Reflect.get(definition, 'type') === type)
                const definitions = block && typeof block === 'object' ? nestedFields(Reflect.get(block, 'fields')) : []
                const data = item.value && typeof item.value === 'object' && !Array.isArray(item.value) ? Reflect.get(item.value, 'data') : {}
                return definitions.length > 0
                  ? <NestedFieldsEditor definitions={definitions} disabled={disabled} onChange={next => store.replace(index, { data: next, type: typeof type === 'string' ? type : '' })} value={data} />
                  : <span>{typeof type === 'string' ? type : `Block ${index + 1}`}</span>
              })()
            : props.renderRepeaterItem?.(item.value, index) ?? (repeaterFields.length > 0
                ? <NestedFieldsEditor definitions={repeaterFields} disabled={disabled} onChange={next => store.replace(index, next)} value={item.value} />
                : <span>{`Item ${index + 1}`}</span>) : null}
        <ShadcnButton aria-expanded={!item.collapsed} disabled={disabled} onClick={() => store.toggleCollapsed(index)} type="button">{item.collapsed ? 'Expand' : 'Collapse'}</ShadcnButton>
        <CollectionActions disabled={disabled} index={index} length={state.items.length} store={store} />
      </li>)}
    </ol>
    {props.context.definition.type === 'builder'
      ? blockDefinitions.map((definition, index) => {
          if (typeof definition !== 'object' || definition === null || Array.isArray(definition)) return null
          const type = Reflect.get(definition, 'type')
          if (typeof type !== 'string') return null
          const label = Reflect.get(definition, 'label')
          return <ShadcnButton
            disabled={disabled || !props.createCollectionItem || (maximum !== null && state.items.length >= maximum)}
            key={type}
            onClick={() => add(type)}
            type="button"
          >Add {typeof label === 'string' ? label : `block ${index + 1}`}</ShadcnButton>
        })
      : <ShadcnButton
          disabled={disabled || (props.context.definition.type !== 'key-value' && !props.createCollectionItem) || (maximum !== null && state.items.length >= maximum)}
          onClick={() => add()}
          type="button"
        >Add item</ShadcnButton>}
    {props.context.errors.length > 0 ? <ul role="alert">{props.context.errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}
