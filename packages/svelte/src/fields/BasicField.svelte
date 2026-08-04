<script lang="ts">
  import type { OptionValue } from '@holo-js/panels-client'
  import type { HTMLInputAttributes } from 'svelte/elements'
  import { toSvelteState } from '../stores'
  import type { SvelteFieldRendererProps } from './contracts'
  import FieldFrame from './FieldFrame.svelte'
  import {
    booleanProperty,
    fieldInputId,
    fieldPresentation,
    fieldProperties,
    numberProperty,
    readFieldValue,
    stringProperty,
    writeFieldValue,
  } from './helpers'

  let { definition, form }: SvelteFieldRendererProps = $props()
  const formState = $derived.by(() => toSvelteState(form))
  const presentation = $derived(fieldPresentation(definition, $formState))
  const value = $derived(readFieldValue($formState.values, definition.path))
  const properties = $derived(fieldProperties(definition))
  const inputId = $derived(fieldInputId(definition.path))
  const kind = $derived(definition.type.split(':').at(-1) ?? 'text')
  const dateMode = $derived(stringProperty(properties, 'mode') ?? 'date')
  const textMode = $derived(stringProperty(properties, 'inputMode') ?? 'text')
  let passwordVisible = $state(false)
  const revealable = $derived(textMode === 'password' && booleanProperty(properties, 'revealable'))
  const inputType = $derived(kind === 'date'
    ? dateMode === 'date-time' ? 'datetime-local' : dateMode === 'time' ? 'time' : 'date'
    : kind === 'color' || kind === 'hidden' || kind === 'radio'
      ? kind
      : textMode === 'password'
        ? passwordVisible ? 'text' : 'password'
        : textMode)
  const datalist = $derived(Array.isArray(properties.datalist) ? properties.datalist.filter((item): item is string => typeof item === 'string') : [])
  const datalistId = $derived(datalist.length > 0 ? `${inputId}-list` : undefined)
  const prefix = $derived(stringProperty(properties, 'prefix'))
  const suffix = $derived(stringProperty(properties, 'suffix'))
  const mask = $derived(stringProperty(properties, 'mask'))
  const autocomplete = $derived(stringProperty(properties, 'autocomplete') as HTMLInputAttributes['autocomplete'])
  const stateLabel = $derived(Boolean(value) ? stringProperty(properties, 'onLabel') : stringProperty(properties, 'offLabel'))
  const radioOptions = $derived.by((): readonly { readonly label: string, readonly value: OptionValue }[] => {
    const options = properties.options
    if (!Array.isArray(options)) return []
    return options.flatMap(option => {
      if (typeof option !== 'object' || option === null || Array.isArray(option)) return []
      const label = option.label
      const optionValue = option.value
      return typeof label === 'string' && (typeof optionValue === 'string' || typeof optionValue === 'number')
        ? [{ label, value: optionValue }]
        : []
    })
  })

  function update(event: Event): void {
    const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement
    const next = target instanceof HTMLInputElement && (target.type === 'checkbox' || target.type === 'radio')
      ? target.checked
      : target instanceof HTMLInputElement && target.type === 'range'
        ? target.valueAsNumber
        : target.value
    writeFieldValue(form, definition.path, next)
  }

  function setRadio(next: OptionValue): void {
    writeFieldValue(form, definition.path, next)
  }

  function dateInputValue(input: unknown): string {
    const date = input instanceof Date ? input : new Date(typeof input === 'string' || typeof input === 'number' ? input : '')
    if (Number.isNaN(date.getTime())) return ''
    const iso = date.toISOString()
    if (dateMode === 'date') return iso.slice(0, 10)
    if (dateMode === 'time') return iso.slice(11, 16)
    return iso.slice(0, 16)
  }

  function updateTextarea(event: Event): void {
    const target = event.currentTarget as HTMLTextAreaElement
    if (booleanProperty(properties, 'autosize')) {
      target.style.height = 'auto'
      target.style.height = `${target.scrollHeight}px`
    }
    update(event)
  }
</script>

{#if presentation.visible}
  <FieldFrame description={definition.helperText} errors={presentation.errors} hint={definition.hint} {inputId} label={definition.label} required={presentation.required}>
    {#snippet children(attributes)}
      {#if kind === 'textarea'}
        <textarea {...attributes} data-autosize={booleanProperty(properties, 'autosize') || undefined} disabled={presentation.disabled} readonly={presentation.readOnly} required={presentation.required} placeholder={definition.placeholder} rows={numberProperty(properties, 'rows') ?? 4} maxlength={numberProperty(properties, 'maximumLength')} value={typeof value === 'string' ? value : ''} oninput={updateTextarea}></textarea>
      {:else if kind === 'checkbox' || kind === 'toggle'}
        <input {...attributes} type="checkbox" role={kind === 'toggle' ? 'switch' : undefined} checked={Boolean(value)} disabled={presentation.disabled || presentation.readOnly} required={presentation.required} aria-readonly={presentation.readOnly} onchange={update} />
        {#if stateLabel}<span class="hp-field-toggle-label">{stateLabel}</span>{/if}
      {:else if kind === 'slider'}
        <input {...attributes} type="range" value={typeof value === 'number' ? value : numberProperty(properties, 'minimum') ?? 0} min={numberProperty(properties, 'minimum')} max={numberProperty(properties, 'maximum')} step={numberProperty(properties, 'step')} disabled={presentation.disabled} readonly={presentation.readOnly} aria-readonly={presentation.readOnly} oninput={update} />
      {:else if kind === 'radio' && radioOptions.length > 0}
        <div {...attributes} role="radiogroup">
          {#each radioOptions as option (option.value)}
            <label><input type="radio" name={inputId} value={option.value} checked={value === option.value} disabled={presentation.disabled || presentation.readOnly} onchange={() => setRadio(option.value)} /> {option.label}</label>
          {/each}
        </div>
      {:else}
        {#if prefix}<span class="hp-field-prefix">{prefix}</span>{/if}
        <input {...attributes} type={inputType} value={kind === 'date' ? dateInputValue(value) : typeof value === 'string' || typeof value === 'number' ? value : ''} disabled={presentation.disabled} readonly={presentation.readOnly} required={presentation.required} placeholder={definition.placeholder} {autocomplete} data-mask={mask} list={datalistId} minlength={numberProperty(properties, 'minimumLength')} maxlength={numberProperty(properties, 'maximumLength')} min={typeof properties.minimum === 'string' || typeof properties.minimum === 'number' ? properties.minimum : undefined} max={typeof properties.maximum === 'string' || typeof properties.maximum === 'number' ? properties.maximum : undefined} step={numberProperty(properties, 'step')} spellcheck={booleanProperty(properties, 'spellcheck', true)} oninput={update} />
        {#if suffix}<span class="hp-field-suffix">{suffix}</span>{/if}
        {#if revealable}<button type="button" aria-controls={inputId} aria-label={passwordVisible ? 'Hide password' : 'Show password'} onclick={() => { passwordVisible = !passwordVisible }}>{passwordVisible ? 'Hide' : 'Show'}</button>{/if}
        {#if datalistId}<datalist id={datalistId}>{#each datalist as option (option)}<option value={option}></option>{/each}</datalist>{/if}
      {/if}
    {/snippet}
  </FieldFrame>
{/if}
