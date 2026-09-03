import { usePanelLocale, usePanelTranslator } from '../localization'
import { useEffect, type ChangeEvent, type ReactNode } from 'react'
import { Button, Input } from '../internal-ui'
import { Progress } from '../ui'
import { requireStore, useStoreState } from './shared'
import type { ReactFieldControlProps } from './types'

export function ReactUploadField<TValues extends object>(props: ReactFieldControlProps<TValues>): ReactNode {
  const locale = usePanelLocale()
  const translate = usePanelTranslator()
  const store = requireStore(props.uploadStore, props.context.definition.type, 'UploadStore')
  useEffect(() => { store.setLocale(locale) }, [store, locale])
  const state = useStoreState(store)
  const disabled = props.context.disabled || props.context.readOnly
  const select = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = event.currentTarget.files
    if (files) store.add([...files])
    event.currentTarget.value = ''
  }
  return <div className="hp-field hp-upload" data-field-path={props.context.definition.path} data-field-type={props.context.definition.type}>
    <label htmlFor={props.context.inputId}>{props.context.definition.label ?? translate('uploads.label')}</label>
    {props.context.definition.helperText ? <div id={`${props.context.inputId}-description`}>{props.context.definition.helperText}</div> : null}
    <Input
      aria-describedby={props.context.definition.helperText ? `${props.context.inputId}-description` : undefined}
      disabled={disabled}
      id={props.context.inputId}
      multiple
      onChange={select}
      type="file"
    />
    {state.error ? <p role="alert">{state.error}</p> : null}
    <ul>
      {state.items.map((item, index) => <li key={item.id}>
        {item.previewUrl ? <img alt={translate('uploads.preview', { name: item.name })} src={item.previewUrl} /> : null}
        <span>{item.name}</span>
        <Progress aria-label={translate('uploads.progress', { name: item.name })} max={1} value={item.progress} />
        <span aria-live="polite">{translate(`uploads.${item.status}`)}</span>
        {item.error ? <span role="alert">{item.error}</span> : null}
        <Button aria-label={translate('uploads.moveUp', { name: item.name })} disabled={disabled || index === 0} onClick={() => store.reorder(index, index - 1)} type="button">↑</Button>
        <Button aria-label={translate('uploads.moveDown', { name: item.name })} disabled={disabled || index === state.items.length - 1} onClick={() => store.reorder(index, index + 1)} type="button">↓</Button>
        <Button aria-label={translate(item.status === 'pending' || item.status === 'uploading' ? 'uploads.cancel' : 'uploads.remove', { name: item.name })} disabled={disabled} onClick={() => void store.remove(item.id)} type="button">{item.status === 'pending' || item.status === 'uploading' ? translate('actions.cancel') : translate('fields.remove')}</Button>
      </li>)}
    </ul>
    {props.context.errors.length > 0 ? <ul role="alert">{props.context.errors.map(error => <li key={error}>{error}</li>)}</ul> : null}
  </div>
}
