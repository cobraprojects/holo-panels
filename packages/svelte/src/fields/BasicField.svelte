<script lang="ts">
  import { Checkbox } from '../ui/checkbox'
  import { Input } from '../ui/input'
  import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText } from '../ui/input-group'
  import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
  import { Switch } from '../ui/switch'
  import { Textarea } from '../ui/textarea'
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

  let { definition, executeAction, form }: SvelteFieldRendererProps = $props()
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
  const prefixAction = $derived(fieldAction(properties.prefixAction))
  const suffixAction = $derived(fieldAction(properties.suffixAction))
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
      : target instanceof HTMLInputElement && (target.type === 'range' || target.type === 'number')
        ? target.value === '' ? null : target.valueAsNumber
        : target.value
    writeFieldValue(form, definition, next)
  }

  function touch(): void {
    form.batch([{ kind: 'touch', path: definition.path }])
  }

  function setRadio(next: OptionValue): void {
    writeFieldValue(form, definition, next)
  }

  function setRadioValue(next: string): void {
    const option = radioOptions.find(candidate => String(candidate.value) === next)
    if (option) setRadio(option.value)
  }

  function fieldAction(value: unknown): { readonly id: string, readonly label: string } | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const id = Reflect.get(value, 'id')
    const label = Reflect.get(value, 'label')
    return typeof id === 'string' && typeof label === 'string' ? { id, label } : null
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
  <FieldFrame description={definition.helperText} errors={presentation.errors} {executeAction} hint={definition.hint} hintAction={properties.hintAction} {inputId} label={definition.label} path={definition.path} required={presentation.required} type={kind}>
    {#snippet children(attributes)}
      {#if kind === 'textarea'}
        <Textarea {...attributes} data-autosize={booleanProperty(properties, 'autosize') || undefined} data-slot="textarea" disabled={presentation.disabled} readonly={presentation.readOnly} required={presentation.required} placeholder={definition.placeholder} rows={numberProperty(properties, 'rows') ?? 4} maxlength={numberProperty(properties, 'maximumLength')} value={typeof value === 'string' ? value : ''} onblur={touch} oninput={updateTextarea}></Textarea>
      {:else if kind === 'checkbox' || kind === 'toggle'}
        {#if kind === 'toggle'}<Switch {...attributes} checked={Boolean(value)} disabled={presentation.disabled || presentation.readOnly} aria-readonly={presentation.readOnly} onblur={touch} onCheckedChange={(checked) => writeFieldValue(form, definition, checked)} />{:else}<Checkbox {...attributes} checked={Boolean(value)} disabled={presentation.disabled || presentation.readOnly} aria-readonly={presentation.readOnly} onblur={touch} onCheckedChange={(checked) => writeFieldValue(form, definition, checked)} />{/if}
        {#if stateLabel}<span class="hp-field-toggle-label">{stateLabel}</span>{/if}
      {:else if kind === 'slider'}
        <Input {...attributes} type="range" data-slot="slider" value={typeof value === 'number' ? value : numberProperty(properties, 'minimum') ?? 0} min={numberProperty(properties, 'minimum')} max={numberProperty(properties, 'maximum')} step={numberProperty(properties, 'step')} disabled={presentation.disabled} readonly={presentation.readOnly} aria-readonly={presentation.readOnly} onblur={touch} oninput={update} />
      {:else if kind === 'radio' && radioOptions.length > 0}
        <RadioGroup {...attributes} value={typeof value === 'string' || typeof value === 'number' ? String(value) : ''} onfocusout={touch} onValueChange={setRadioValue}>
          {#each radioOptions as option (option.value)}
            <label class="hp:flex hp:items-center hp:gap-2"><RadioGroupItem value={String(option.value)} disabled={presentation.disabled || presentation.readOnly} />{option.label}</label>
          {/each}
        </RadioGroup>
      {:else}
        {#if prefix || suffix || prefixAction || suffixAction || revealable}
          <InputGroup>
            {#if prefix || prefixAction}<InputGroupAddon align="inline-start">{#if prefix}<InputGroupText class="hp-field-prefix">{prefix}</InputGroupText>{/if}{#if prefixAction}<InputGroupButton onclick={() => executeAction?.(prefixAction.id)}>{prefixAction.label}</InputGroupButton>{/if}</InputGroupAddon>{/if}
            <InputGroupInput {...attributes} type={inputType} value={kind === 'date' ? dateInputValue(value) : typeof value === 'string' || typeof value === 'number' ? value : ''} disabled={presentation.disabled} readonly={presentation.readOnly} required={presentation.required} placeholder={definition.placeholder} {autocomplete} data-mask={mask} list={datalistId} minlength={numberProperty(properties, 'minimumLength')} maxlength={numberProperty(properties, 'maximumLength')} min={typeof properties.minimum === 'string' || typeof properties.minimum === 'number' ? properties.minimum : undefined} max={typeof properties.maximum === 'string' || typeof properties.maximum === 'number' ? properties.maximum : undefined} step={numberProperty(properties, 'step')} spellcheck={booleanProperty(properties, 'spellcheck', true)} onblur={touch} oninput={update} />
            {#if suffix || suffixAction || revealable}<InputGroupAddon align="inline-end">{#if suffix}<InputGroupText class="hp-field-suffix">{suffix}</InputGroupText>{/if}{#if suffixAction}<InputGroupButton onclick={() => executeAction?.(suffixAction.id)}>{suffixAction.label}</InputGroupButton>{/if}{#if revealable}<InputGroupButton aria-controls={inputId} aria-label={passwordVisible ? 'Hide password' : 'Show password'} onclick={() => { passwordVisible = !passwordVisible }}>{passwordVisible ? 'Hide' : 'Show'}</InputGroupButton>{/if}</InputGroupAddon>{/if}
          </InputGroup>
        {:else}
          <Input {...attributes} type={inputType} data-slot="input" value={kind === 'date' ? dateInputValue(value) : typeof value === 'string' || typeof value === 'number' ? value : ''} disabled={presentation.disabled} readonly={presentation.readOnly} required={presentation.required} placeholder={definition.placeholder} {autocomplete} data-mask={mask} list={datalistId} minlength={numberProperty(properties, 'minimumLength')} maxlength={numberProperty(properties, 'maximumLength')} min={typeof properties.minimum === 'string' || typeof properties.minimum === 'number' ? properties.minimum : undefined} max={typeof properties.maximum === 'string' || typeof properties.maximum === 'number' ? properties.maximum : undefined} step={numberProperty(properties, 'step')} spellcheck={booleanProperty(properties, 'spellcheck', true)} onblur={touch} oninput={update} />
        {/if}
        {#if datalistId}<datalist id={datalistId}>{#each datalist as option (option)}<option value={option}></option>{/each}</datalist>{/if}
      {/if}
    {/snippet}
  </FieldFrame>
{/if}
