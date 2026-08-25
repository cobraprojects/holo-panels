import type { ChangeEvent, ReactNode } from 'react'
import { Button, Input } from '../internal-ui'
import { Progress } from '../ui'
import { requireStore, useStoreState } from './shared'
import type { ReactFieldControlProps } from './types'

export function ReactUploadField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const store = requireStore(props.uploadStore, props.context.definition.type, 'UploadStore')
  const state = useStoreState(store)
  const disabled = props.context.disabled || props.context.readOnly
  const select = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.currentTarget.files
    if (files) store.add([...files])
    event.currentTarget.value = ''
  }
  return <div className="hp-field hp-upload" data-field-path={props.context.definition.path} data-field-type={props.context.definition.type}>
    <label htmlFor={props.context.inputId}>{props.context.definition.label ?? 'Upload files'}</label>
    {props.context.definition.helperText ? <div id={`${props.context.inputId}-description`}>{props.context.definition.helperText}</div> : null}
    <Input
      aria-describedby={props.context.definition.helperText ? `${props.context.inputId}-description` : undefined}
      disabled={disabled}
      id={props.context.inputId}
      multiple
      onChange={select}
      type="file"
    />
    <ul>
      {state.items.map((item, index) => <li key={item.id}>
        {item.previewUrl ? <img alt={`Preview of ${item.name}`} src={item.previewUrl} /> : null}
        <span>{item.name}</span>
        <Progress aria-label={`Upload progress for ${item.name}`} max={1} value={item.progress} />
        <span aria-live="polite">{item.status}</span>
        {item.error ? <span role="alert">{item.error}</span> : null}
        <Button aria-label={`Move ${item.name} up`} disabled={disabled || index === 0} onClick={() => store.reorder(index, index - 1)} type="button">↑</Button>
        <Button aria-label={`Move ${item.name} down`} disabled={disabled || index === state.items.length - 1} onClick={() => store.reorder(index, index + 1)} type="button">↓</Button>
        <Button aria-label={`Remove ${item.name}`} disabled={disabled} onClick={() => void store.remove(item.id)} type="button">Remove</Button>
      </li>)}
    </ul>
    {props.context.errors.length > 0 ? <ul role="alert">{props.context.errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}
