<script lang="ts">
  import type { SvelteCustomFieldProps } from '../src/fields/contracts'

  let { definition, value, errors, disabled, readOnly, required, inputId, setValue }: SvelteCustomFieldProps = $props()
</script>

<output data-custom-path={definition.path} data-errors={errors.length} data-disabled={disabled} data-readonly={readOnly} data-required={required} id={inputId}>{String(value)}</output>
<button type="button" onclick={() => setValue('custom-updated')}>Set custom value</button>
