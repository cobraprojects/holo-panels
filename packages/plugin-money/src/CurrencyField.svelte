<script lang="ts">
  import type { SvelteCustomFieldProps } from '@holo-js/panels-svelte'

  let props: SvelteCustomFieldProps = $props()
  const currency = $derived(typeof props.definition.properties?.currency === 'string' ? props.definition.properties.currency : 'USD')
  const minorUnits = $derived(typeof props.definition.properties?.minorUnits === 'number' ? props.definition.properties.minorUnits : 2)
</script>

<label class="hp-money-field" for={props.inputId}>
  <span>{props.definition.label ?? currency}</span>
  <input
    aria-invalid={props.errors.length > 0 || undefined}
    disabled={props.disabled}
    id={props.inputId}
    inputmode="decimal"
    readonly={props.readOnly}
    step={10 ** -minorUnits}
    type="number"
    value={typeof props.value === 'number' ? props.value : ''}
    onchange={(event) => props.setValue(Number(event.currentTarget.value))}
  />
  <span>{currency}</span>
</label>
